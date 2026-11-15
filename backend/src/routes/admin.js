
const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { verificarToken, soloRoles } = require("../middlewares/auth");
const { ESPECIALIDADES } = require("../utils/especialidades");

const router = express.Router();

// Todas estas rutas son exclusivas del administrador.
router.use(verificarToken, soloRoles("admin"));

function obtenerId(valor) {
    const id = Number(valor);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validarDatosDoctor(datos) {
    const nombre = String(datos.nombre ?? "").trim();
    const correo = String(datos.correo ?? "").trim().toLowerCase();
    const especialidad = String(datos.especialidad ?? "").trim();
    const telefono = String(datos.telefono ?? "").trim();
    const precioConsulta = Number(datos.precioConsulta);

    if (!nombre || !correo || !especialidad) {
        return { error: "Nombre, correo y especialidad son obligatorios" };
    }

    if (nombre.length > 120 || correo.length > 150 || telefono.length > 30) {
        return { error: "Uno de los campos supera la longitud permitida" };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        return { error: "El correo no es válido" };
    }

    if (!ESPECIALIDADES.includes(especialidad)) {
        return {
            error: "Especialidad no válida. Opciones: " +
                ESPECIALIDADES.join(", ")
        };
    }

    if (
        !Number.isFinite(precioConsulta) ||
        precioConsulta < 0 ||
        precioConsulta > 99999999.99
    ) {
        return { error: "El precio de consulta no es válido" };
    }

    return {
        datos: {
            nombre,
            correo,
            especialidad,
            telefono: telefono || null,
            precioConsulta
        }
    };
}

// ========================================
// GET /api/admin/doctores
// LISTAR TODOS LOS DOCTORES
// ========================================

router.get("/doctores", async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT
                d.id,
                d.nombre,
                d.especialidad,
                d.telefono,
                d.precio_consulta AS "precioConsulta",
                u.correo,
                u.activo,
                u.creado_en AS "creadoEn"
            FROM doctores d
            JOIN usuarios u ON u.id = d.usuario_id
            ORDER BY d.nombre ASC
        `);

        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al listar doctores:", error);
        res.status(500).json({
            mensaje: "No se pudo obtener la lista de doctores"
        });
    }
});

// ========================================
// GET /api/admin/doctores/:id
// CONSULTAR UN DOCTOR
// ========================================

router.get("/doctores/:id", async (req, res) => {
    const id = obtenerId(req.params.id);

    if (!id) {
        return res.status(400).json({ mensaje: "ID inválido" });
    }

    try {
        const resultado = await pool.query(`
            SELECT
                d.id,
                d.nombre,
                d.especialidad,
                d.telefono,
                d.precio_consulta AS "precioConsulta",
                u.correo,
                u.activo
            FROM doctores d
            JOIN usuarios u ON u.id = d.usuario_id
            WHERE d.id = $1
        `, [id]);

        if (!resultado.rows.length) {
            return res.status(404).json({
                mensaje: "Doctor no encontrado"
            });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: "Error al consultar el doctor"
        });
    }
});

// ========================================
// PUT /api/admin/doctores/:id
// EDITAR DOCTOR
// ========================================

router.put("/doctores/:id", async (req, res) => {
    const id = obtenerId(req.params.id);

    if (!id) {
        return res.status(400).json({ mensaje: "ID inválido" });
    }

    const validacion = validarDatosDoctor(req.body || {});

    if (validacion.error) {
        return res.status(400).json({
            mensaje: validacion.error
        });
    }

    const {
        nombre,
        correo,
        especialidad,
        telefono,
        precioConsulta
    } = validacion.datos;

    let cliente;

    try {
        cliente = await pool.connect();
        await cliente.query("BEGIN");

        const existente = await cliente.query(`
            SELECT d.usuario_id
            FROM doctores d
            WHERE d.id = $1
            FOR UPDATE OF d
        `, [id]);

        if (!existente.rows.length) {
            await cliente.query("ROLLBACK");
            return res.status(404).json({
                mensaje: "Doctor no encontrado"
            });
        }

        const usuarioId = existente.rows[0].usuario_id;

        await cliente.query(`
            UPDATE usuarios
            SET correo = $1
            WHERE id = $2
        `, [correo, usuarioId]);

        const actualizado = await cliente.query(`
            UPDATE doctores
            SET
                nombre = $1,
                especialidad = $2,
                telefono = $3,
                precio_consulta = $4
            WHERE id = $5
            RETURNING
                id,
                nombre,
                especialidad,
                telefono,
                precio_consulta AS "precioConsulta"
        `, [
            nombre,
            especialidad,
            telefono,
            precioConsulta,
            id
        ]);

        await cliente.query("COMMIT");

        res.json({
            mensaje: "Doctor actualizado correctamente",
            doctor: {
                ...actualizado.rows[0],
                correo
            }
        });

    } catch (error) {
        if (cliente) {
            await cliente.query("ROLLBACK");
        }

        if (error.code === "23505") {
            return res.status(409).json({
                mensaje: "Ese correo ya pertenece a otra cuenta"
            });
        }

        console.error(error);
        res.status(500).json({
            mensaje: "No se pudo actualizar el doctor"
        });
    } finally {
        if (cliente) cliente.release();
    }
});

// ========================================
// PATCH /api/admin/doctores/:id/estado
// DESACTIVAR O REACTIVAR
// ========================================

router.patch("/doctores/:id/estado", async (req, res) => {
    const id = obtenerId(req.params.id);
    const { activo } = req.body || {};

    if (!id) {
        return res.status(400).json({ mensaje: "ID inválido" });
    }

    if (typeof activo !== "boolean") {
        return res.status(400).json({
            mensaje: "El campo activo debe ser true o false"
        });
    }

    try {
        const resultado = await pool.query(`
            UPDATE usuarios
            SET activo = $1
            WHERE id = (
                SELECT usuario_id
                FROM doctores
                WHERE id = $2
            )
            AND rol = 'doctor'
            RETURNING id, correo, activo
        `, [activo, id]);

        if (!resultado.rows.length) {
            return res.status(404).json({
                mensaje: "Doctor no encontrado"
            });
        }

        res.json({
            mensaje: activo
                ? "Doctor reactivado correctamente"
                : "Doctor desactivado correctamente",
            usuario: resultado.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: "No se pudo cambiar el estado"
        });
    }
});

// ========================================
// PATCH /api/admin/doctores/:id/contrasena
// RESTABLECER CONTRASEÑA TEMPORAL
// ========================================

router.patch("/doctores/:id/contrasena", async (req, res) => {
    const id = obtenerId(req.params.id);
    const contrasena = req.body?.contrasena;

    if (!id) {
        return res.status(400).json({ mensaje: "ID inválido" });
    }

    if (
        typeof contrasena !== "string" ||
        contrasena.length < 8 ||
        contrasena.length > 128
    ) {
        return res.status(400).json({
            mensaje: "La contraseña debe tener entre 8 y 128 caracteres"
        });
    }

    try {
        const hash = await bcrypt.hash(contrasena, 10);

        const resultado = await pool.query(`
            UPDATE usuarios
            SET contrasena_hash = $1
            WHERE id = (
                SELECT usuario_id
                FROM doctores
                WHERE id = $2
            )
            AND rol = 'doctor'
            RETURNING id
        `, [hash, id]);

        if (!resultado.rows.length) {
            return res.status(404).json({
                mensaje: "Doctor no encontrado"
            });
        }

        res.json({
            mensaje: "Contraseña restablecida correctamente"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: "No se pudo restablecer la contraseña"
        });
    }
});

// ========================================
// GET /api/admin/resumen
// RESUMEN DE DOCTORES
// ========================================

router.get("/resumen", async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT
                COUNT(*)::integer AS total,
                COUNT(*) FILTER (
                    WHERE u.activo = TRUE
                )::integer AS activos,
                COUNT(*) FILTER (
                    WHERE u.activo = FALSE
                )::integer AS inactivos
            FROM doctores d
            JOIN usuarios u ON u.id = d.usuario_id
        `);

        res.json(resultado.rows[0]);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: "No se pudo obtener el resumen"
        });
    }
});

module.exports = router;
