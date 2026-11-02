// ========================================
// RUTAS DE PACIENTES (RECEPCIÓN)
// ========================================

const express = require("express");
const pool = require("../db");
const { verificarToken, soloRoles } = require("../middlewares/auth");
const { fechaValida, fechaDeHoy } = require("../utils/fechas");

const router = express.Router();


// ========================================
// POST /api/pacientes
// Registra un paciente que NO usa la app
// ========================================

router.post(
    "/",
    verificarToken,
    soloRoles("doctor"),
    async function(peticion, respuesta) {

        const nombre =
            String(peticion.body.nombre || "").trim();

        const telefono =
            String(peticion.body.telefono || "").trim();

        const documento =
            String(peticion.body.documento || "").trim();

        const fechaNacimiento =
            String(peticion.body.fechaNacimiento || "").trim();


        if (nombre === "") {

            return respuesta.status(400).json({
                mensaje: "El nombre es obligatorio"
            });

        }

        // La fecha de nacimiento es opcional, pero si viene,
        // debe ser real y no estar en el futuro
        if (fechaNacimiento !== "") {

            if (
                !fechaValida(fechaNacimiento) ||
                fechaNacimiento > fechaDeHoy()
            ) {

                return respuesta.status(400).json({
                    mensaje: "La fecha de nacimiento no es válida"
                });

            }

        }


        try {

            const resultado = await pool.query(
                "INSERT INTO pacientes " +
                "(nombre, telefono, documento, fecha_nacimiento) " +
                "VALUES ($1, $2, $3, $4) " +
                "RETURNING id, nombre, telefono, documento, fecha_nacimiento",
                [
                    nombre,
                    telefono || null,
                    documento || null,
                    fechaNacimiento || null
                ]
            );

            respuesta.status(201).json(resultado.rows[0]);

        } catch (error) {

            // 23505: ya existe un paciente con ese documento
            if (error.code === "23505") {

                return respuesta.status(409).json({
                    mensaje: "Ya existe un paciente con ese documento"
                });

            }

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al registrar el paciente"
            });

        }

    }
);


// ========================================
// GET /api/pacientes?buscar=texto
// Busca por nombre, documento o teléfono
// ========================================

router.get(
    "/",
    verificarToken,
    soloRoles("doctor"),
    async function(peticion, respuesta) {

        const texto = String(peticion.query.buscar || "").trim();

        if (texto.length < 2) {

            return respuesta.status(400).json({
                mensaje: "Escribe al menos 2 caracteres para buscar"
            });

        }


        try {

            // El comodín % va dentro del VALOR, no del SQL
            const patron = "%" + texto + "%";

            const resultado = await pool.query(
                "SELECT id, nombre, telefono, documento " +
                "FROM pacientes " +
                "WHERE nombre ILIKE $1 " +
                "OR documento ILIKE $1 " +
                "OR telefono ILIKE $1 " +
                "ORDER BY nombre " +
                "LIMIT 20",
                [patron]
            );

            respuesta.json(resultado.rows);

        } catch (error) {

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al buscar pacientes"
            });

        }

    }
);


module.exports = router;