const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const { verificarToken, soloRoles } = require("../middlewares/auth");

const router = express.Router();


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