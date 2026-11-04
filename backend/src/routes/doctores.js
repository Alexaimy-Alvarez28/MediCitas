// ========================================
// RUTAS DE DOCTORES
// ========================================

const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { verificarToken, soloRoles } = require("../middlewares/auth");
const { fechaValida, fechaDeHoy } = require("../utils/fechas");
const { HORAS_VALIDAS } = require("../utils/horarios");
const { ESPECIALIDADES } = require("../utils/especialidades");

const router = express.Router();


// Perfil del doctor que inició sesión ($1 = id de USUARIO)
const SQL_PERFIL_DOCTOR =
    "SELECT d.id, d.nombre, d.especialidad, d.telefono, " +
    "d.precio_consulta, u.correo " +
    "FROM doctores d " +
    "JOIN usuarios u ON u.id = d.usuario_id " +
    "WHERE d.usuario_id = $1";


function armarPerfilDoctor(fila) {

    return {

        id: fila.id,

        nombre: fila.nombre,

        correo: fila.correo,

        especialidad: fila.especialidad,

        telefono: fila.telefono,

        precioConsulta: fila.precio_consulta

    };

}


// ========================================
// GET /api/doctores
// Lista de doctores (requiere iniciar sesión)
// ========================================

router.get("/", verificarToken, async function(peticion, respuesta) {

    try {

        const resultado = await pool.query(
            "SELECT id, nombre, especialidad, precio_consulta " +
            "FROM doctores ORDER BY nombre"
        );

        respuesta.json(resultado.rows);

    } catch (error) {

        console.error(error);

        respuesta.status(500).json({
            mensaje: "Error al obtener los doctores"
        });

    }

});


// ========================================
// IMPORTANTE: las rutas "/yo" van ANTES de "/:id".
// Si no, Express leería "yo" como si fuera un id.
// ========================================


// ========================================
// GET /api/doctores/yo
// El perfil del doctor que inició sesión
// ========================================

router.get(
    "/yo",
    verificarToken,
    soloRoles("doctor"),
    async function(peticion, respuesta) {

        try {

            const resultado =
                await pool.query(SQL_PERFIL_DOCTOR, [peticion.usuario.id]);

            if (resultado.rows.length === 0) {

                return respuesta.status(404).json({
                    mensaje: "No se encontró tu perfil de doctor"
                });

            }

            respuesta.json(armarPerfilDoctor(resultado.rows[0]));

        } catch (error) {

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al obtener el perfil"
            });

        }

    }
);


// ========================================
// PUT /api/doctores/yo
// Guarda nombre, especialidad y teléfono del doctor
// ========================================
// El correo y el precio de la consulta los define la clínica
// (administrador), no se cambian desde aquí.
// ========================================

router.put(
    "/yo",
    verificarToken,
    soloRoles("doctor"),
    async function(peticion, respuesta) {

        const nombre = String(peticion.body.nombre || "").trim();

        const especialidad =
            String(peticion.body.especialidad || "").trim();

        const telefono = String(peticion.body.telefono || "").trim();


        if (nombre === "") {

            return respuesta.status(400).json({
                mensaje: "El nombre es obligatorio"
            });

        }

        if (nombre.length > 120 || telefono.length > 30) {

            return respuesta.status(400).json({
                mensaje: "Alguno de los textos es demasiado largo"
            });

        }

        if (!ESPECIALIDADES.includes(especialidad)) {

            return respuesta.status(400).json({
                mensaje:
                    "Especialidad no válida. Opciones: " +
                    ESPECIALIDADES.join(", ")
            });

        }


        try {

            const actualizacion = await pool.query(
                "UPDATE doctores " +
                "SET nombre = $1, especialidad = $2, telefono = $3 " +
                "WHERE usuario_id = $4 RETURNING id",
                [nombre, especialidad, telefono || null, peticion.usuario.id]
            );

            if (actualizacion.rowCount === 0) {

                return respuesta.status(404).json({
                    mensaje: "No se encontró tu perfil de doctor"
                });

            }

            const resultado =
                await pool.query(SQL_PERFIL_DOCTOR, [peticion.usuario.id]);

            respuesta.json(armarPerfilDoctor(resultado.rows[0]));

        } catch (error) {

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al guardar el perfil"
            });

        }

    }
);


// ========================================
// GET /api/doctores/:id/disponibilidad?fecha=AAAA-MM-DD
// Qué horas están libres u ocupadas ese día
// ========================================
// Dice QUÉ horas están ocupadas, pero no quién las ocupa.
// ========================================

router.get(
    "/:id/disponibilidad",
    verificarToken,
    async function(peticion, respuesta) {

        const id = Number(peticion.params.id);

        if (!Number.isInteger(id)) {

            return respuesta.status(400).json({
                mensaje: "El id debe ser un número"
            });

        }

        const fecha = String(peticion.query.fecha || "").trim();

        if (!fechaValida(fecha)) {

            return respuesta.status(400).json({
                mensaje: "La fecha debe tener el formato AAAA-MM-DD"
            });

        }


        try {

            const doctor = await pool.query(
                "SELECT id FROM doctores WHERE id = $1",
                [id]
            );

            if (doctor.rows.length === 0) {

                return respuesta.status(404).json({
                    mensaje: "Doctor no encontrado"
                });

            }

            const ocupadas = await pool.query(
                "SELECT to_char(hora, 'HH24:MI') AS hora " +
                "FROM citas " +
                "WHERE doctor_id = $1 AND fecha = $2 " +
                "AND estado <> 'Cancelada'",
                [id, fecha]
            );

            const horasOcupadas = ocupadas.rows.map(function(fila) {

                return fila.hora;

            });

            // En una fecha pasada nada está disponible
            const esPasada = fecha < fechaDeHoy();

            const horas = HORAS_VALIDAS.map(function(hora) {

                return {

                    hora: hora,

                    disponible:
                        !esPasada && !horasOcupadas.includes(hora)

                };

            });

            respuesta.json({

                doctorId: id,

                fecha: fecha,

                horas: horas

            });

        } catch (error) {

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al obtener la disponibilidad"
            });

        }

    }
);


// ========================================
// GET /api/doctores/:id
// ========================================

router.get("/:id", verificarToken, async function(peticion, respuesta) {

    try {

        const id = Number(peticion.params.id);

        if (!Number.isInteger(id)) {

            return respuesta.status(400).json({
                mensaje: "El id debe ser un número"
            });

        }

        const resultado = await pool.query(
            "SELECT id, nombre, especialidad, precio_consulta " +
            "FROM doctores WHERE id = $1",
            [id]
        );

        if (resultado.rows.length === 0) {

            return respuesta.status(404).json({
                mensaje: "Doctor no encontrado"
            });

        }

        respuesta.json(resultado.rows[0]);

    } catch (error) {

        console.error(error);

        respuesta.status(500).json({
            mensaje: "Error al obtener el doctor"
        });

    }

});


// ========================================
// POST /api/doctores
// SOLO ADMINISTRADOR: crea la cuenta de un doctor
// ========================================
// El administrador define una contraseña temporal
// que entrega al doctor.
// ========================================

router.post(
    "/",
    verificarToken,
    soloRoles("admin"),
    async function(peticion, respuesta) {

        const nombre =
            String(peticion.body.nombre || "").trim();

        const correo =
            String(peticion.body.correo || "").trim().toLowerCase();

        const contrasena =
            String(peticion.body.contrasena || "");

        const especialidad =
            String(peticion.body.especialidad || "").trim();

        const telefono =
            String(peticion.body.telefono || "").trim();

        const precioConsulta =
            Number(peticion.body.precioConsulta || 0);


        // ---------- Validaciones ----------

        if (
            nombre === "" ||
            correo === "" ||
            contrasena === "" ||
            especialidad === ""
        ) {

            return respuesta.status(400).json({
                mensaje:
                    "Nombre, correo, contraseña y especialidad son obligatorios"
            });

        }

        if (nombre.length > 120 || telefono.length > 30) {

            return respuesta.status(400).json({
                mensaje: "Alguno de los textos es demasiado largo"
            });

        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {

            return respuesta.status(400).json({
                mensaje: "El correo no tiene un formato válido"
            });

        }

        if (contrasena.length < 8) {

            return respuesta.status(400).json({
                mensaje: "La contraseña debe tener al menos 8 caracteres"
            });

        }

        if (!ESPECIALIDADES.includes(especialidad)) {

            return respuesta.status(400).json({
                mensaje:
                    "Especialidad no válida. Opciones: " +
                    ESPECIALIDADES.join(", ")
            });

        }

        if (!Number.isFinite(precioConsulta) || precioConsulta < 0) {

            return respuesta.status(400).json({
                mensaje: "El precio de la consulta no es válido"
            });

        }


        let cliente;

        try {

            const hash = await bcrypt.hash(contrasena, 10);

            cliente = await pool.connect();

            await cliente.query("BEGIN");

            const usuario = await cliente.query(
                "INSERT INTO usuarios (correo, contrasena_hash, rol) " +
                "VALUES ($1, $2, 'doctor') RETURNING id",
                [correo, hash]
            );

            const doctor = await cliente.query(
                "INSERT INTO doctores " +
                "(usuario_id, nombre, especialidad, telefono, precio_consulta) " +
                "VALUES ($1, $2, $3, $4, $5) " +
                "RETURNING id, nombre, especialidad, telefono, precio_consulta",
                [
                    usuario.rows[0].id,
                    nombre,
                    especialidad,
                    telefono || null,
                    precioConsulta
                ]
            );

            await cliente.query("COMMIT");

            respuesta.status(201).json({

                ...doctor.rows[0],

                correo: correo

            });

        } catch (error) {

            if (cliente) {

                await cliente.query("ROLLBACK");

            }

            if (error.code === "23505") {

                return respuesta.status(409).json({
                    mensaje: "Ya existe una cuenta con ese correo"
                });

            }

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al crear el doctor"
            });

        } finally {

            if (cliente) {

                cliente.release();

            }

        }

    }
);


module.exports = router;