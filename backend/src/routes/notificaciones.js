// ========================================
// RUTAS DE NOTIFICACIONES
// ========================================
// Cada usuario solo ve las suyas: el id sale del TOKEN.
// ========================================

const express = require("express");
const pool = require("../db");
const { verificarToken } = require("../middlewares/auth");

const router = express.Router();


// ========================================
// GET /api/notificaciones
// Las últimas 30 y cuántas no se han leído
// ========================================

router.get("/", verificarToken, async function(peticion, respuesta) {

    try {

        const consultas = await Promise.all([

            pool.query(
                "SELECT id, mensaje, leida, creado_en " +
                "FROM notificaciones " +
                "WHERE usuario_id = $1 " +
                "ORDER BY creado_en DESC, id DESC " +
                "LIMIT 30",
                [peticion.usuario.id]
            ),

            pool.query(
                "SELECT COUNT(*)::int AS total " +
                "FROM notificaciones " +
                "WHERE usuario_id = $1 AND leida = FALSE",
                [peticion.usuario.id]
            )

        ]);

        respuesta.json({

            noLeidas: consultas[1].rows[0].total,

            notificaciones: consultas[0].rows

        });

    } catch (error) {

        console.error(error);

        respuesta.status(500).json({
            mensaje: "Error al obtener las notificaciones"
        });

    }

});


// ========================================
// PATCH /api/notificaciones/leer
// Marca como leídas todas las del usuario
// ========================================

router.patch("/leer", verificarToken, async function(peticion, respuesta) {

    try {

        const resultado = await pool.query(
            "UPDATE notificaciones SET leida = TRUE " +
            "WHERE usuario_id = $1 AND leida = FALSE",
            [peticion.usuario.id]
        );

        respuesta.json({ marcadas: resultado.rowCount });

    } catch (error) {

        console.error(error);

        respuesta.status(500).json({
            mensaje: "Error al marcar las notificaciones"
        });

    }

});


module.exports = router;