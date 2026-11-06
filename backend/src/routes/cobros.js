// ========================================
// RUTAS DE COBROS
// ========================================
// Se montan bajo /api/citas, así que las rutas finales son:
//     GET   /api/citas/por-cobrar
//     PATCH /api/citas/:id/pago
// ========================================

const express = require("express");
const pool = require("../db");
const { verificarToken, soloRoles } = require("../middlewares/auth");
const { fechaValida, fechaDeHoy } = require("../utils/fechas");

const router = express.Router();

const METODOS_PAGO = ["efectivo", "tarjeta", "seguro", "transferencia"];


// ========================================
// GET /api/citas/por-cobrar?fecha=AAAA-MM-DD
// Citas del día, en consulta o completadas, sin cobrar
// ========================================
// Si no se indica fecha, se usa la de hoy.
// ========================================

router.get(
    "/por-cobrar",
    verificarToken,
    soloRoles("doctor"),
    async function(peticion, respuesta) {

        const fecha =
            peticion.query.fecha !== undefined
                ? String(peticion.query.fecha)
                : fechaDeHoy();

        if (!fechaValida(fecha)) {

            return respuesta.status(400).json({
                mensaje: "La fecha debe tener el formato AAAA-MM-DD"
            });

        }


        try {

            const doctor = await pool.query(
                "SELECT id, precio_consulta FROM doctores " +
                "WHERE usuario_id = $1",
                [peticion.usuario.id]
            );

            if (doctor.rows.length === 0) {

                return respuesta.status(404).json({
                    mensaje: "No se encontró tu perfil de doctor"
                });

            }

            const resultado = await pool.query(
                "SELECT c.id, c.estado, " +
                "to_char(c.hora, 'HH24:MI') AS hora, " +
                "c.motivo, p.nombre AS paciente " +
                "FROM citas c " +
                "JOIN pacientes p ON p.id = c.paciente_id " +
                "WHERE c.doctor_id = $1 AND c.fecha = $2 " +
                "AND c.estado IN ('En consulta', 'Completada') " +
                "AND c.pagado_en IS NULL " +
                "ORDER BY c.hora",
                [doctor.rows[0].id, fecha]
            );

            respuesta.json({

                fecha: fecha,

                precioConsulta: doctor.rows[0].precio_consulta,

                citas: resultado.rows

            });

        } catch (error) {

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al obtener las citas por cobrar"
            });

        }

    }
);


// ========================================
// PATCH /api/citas/:id/pago
// Registra el cobro de una cita (doctor / recepción)
// ========================================
// Body: { "metodoPago": "efectivo", "monto": 2000 }
// "monto" es opcional: si no viene, se cobra el precio
// de consulta del doctor.
// ========================================

router.patch(
    "/:id/pago",
    verificarToken,
    soloRoles("doctor"),
    async function(peticion, respuesta) {

        const id = Number(peticion.params.id);

        if (!Number.isInteger(id)) {

            return respuesta.status(400).json({
                mensaje: "El id debe ser un número"
            });

        }

        const metodoPago =
            String(peticion.body.metodoPago || "").trim();

        if (!METODOS_PAGO.includes(metodoPago)) {

            return respuesta.status(400).json({
                mensaje:
                    "Método de pago no válido. Usa: " +
                    METODOS_PAGO.join(", ")
            });

        }

        // El monto es opcional
        let monto = null;

        if (
            peticion.body.monto !== undefined &&
            peticion.body.monto !== null
        ) {

            monto = Number(peticion.body.monto);

            if (!Number.isFinite(monto) || monto < 0) {

                return respuesta.status(400).json({
                    mensaje: "El monto no es válido"
                });

            }

        }


        try {

            const doctor = await pool.query(
                "SELECT id, precio_consulta FROM doctores " +
                "WHERE usuario_id = $1",
                [peticion.usuario.id]
            );

            if (doctor.rows.length === 0) {

                return respuesta.status(404).json({
                    mensaje: "No se encontró tu perfil de doctor"
                });

            }

            const busqueda = await pool.query(
                "SELECT id, doctor_id, estado, pagado_en " +
                "FROM citas WHERE id = $1",
                [id]
            );

            const cita = busqueda.rows[0];

            if (!cita) {

                return respuesta.status(404).json({
                    mensaje: "Cita no encontrada"
                });

            }

            // Solo el doctor dueño de la cita puede cobrarla
            if (cita.doctor_id !== doctor.rows[0].id) {

                return respuesta.status(403).json({
                    mensaje: "No tienes permiso para modificar esta cita"
                });

            }

            if (
                cita.estado !== "En consulta" &&
                cita.estado !== "Completada"
            ) {

                return respuesta.status(409).json({
                    mensaje:
                        "Solo se puede cobrar una cita en consulta " +
                        "o completada"
                });

            }

            if (cita.pagado_en !== null) {

                return respuesta.status(409).json({
                    mensaje: "Esta cita ya fue cobrada"
                });

            }


            const montoFinal =
                monto !== null ? monto : doctor.rows[0].precio_consulta;

            // "AND pagado_en IS NULL": si otra persona la cobró justo
            // antes, este UPDATE no encuentra fila (evita cobrar dos veces)
            const resultado = await pool.query(
                "UPDATE citas " +
                "SET monto = $1, metodo_pago = $2, pagado_en = NOW() " +
                "WHERE id = $3 AND pagado_en IS NULL " +
                "RETURNING id, estado, monto, metodo_pago, pagado_en",
                [montoFinal, metodoPago, id]
            );

            if (resultado.rowCount === 0) {

                return respuesta.status(409).json({
                    mensaje: "Esta cita ya fue cobrada"
                });

            }

            respuesta.json(resultado.rows[0]);

        } catch (error) {

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al registrar el cobro"
            });

        }

    }
);


module.exports = router;