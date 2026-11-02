// ========================================
// RUTAS DE CITAS
// ========================================

const express = require("express");
const pool = require("../db");
const { verificarToken, soloRoles } = require("../middlewares/auth");
const { fechaValida, fechaDeHoy } = require("../utils/fechas");

const router = express.Router();


// Horas en las que se puede agendar (por ahora iguales para
// todos los doctores; luego vendrán de la tabla de horarios)
const HORAS_VALIDAS = [
    "08:00", "09:00", "10:00", "11:00",
    "13:00", "14:00", "15:00", "16:00"
];


// ========================================
// FUNCIONES AUXILIARES
// ========================================

// Del id de usuario (token) obtenemos su id de paciente
async function obtenerPacienteId(usuarioId) {

    const resultado = await pool.query(
        "SELECT id FROM pacientes WHERE usuario_id = $1",
        [usuarioId]
    );

    return resultado.rows[0] ? resultado.rows[0].id : null;

}


// Del id de usuario (token) obtenemos su id de doctor
async function obtenerDoctorId(usuarioId) {

    const resultado = await pool.query(
        "SELECT id FROM doctores WHERE usuario_id = $1",
        [usuarioId]
    );

    return resultado.rows[0] ? resultado.rows[0].id : null;

}


// ========================================
// POST /api/citas
// Crea una cita
// ========================================
// - Paciente: agenda para sí mismo (origen "app")
// - Doctor/secretaria: agenda para un paciente (origen "manual")
// ========================================

router.post(
    "/",
    verificarToken,
    soloRoles("paciente", "doctor"),
    async function(peticion, respuesta) {

        const fecha = String(peticion.body.fecha || "").trim();

        const hora = String(peticion.body.hora || "").trim();

        const motivo = String(peticion.body.motivo || "").trim();


        // ---------- Reglas de negocio ----------

        if (!fechaValida(fecha)) {

            return respuesta.status(400).json({
                mensaje: "La fecha debe tener el formato AAAA-MM-DD"
            });

        }

        // Como ambas son texto "AAAA-MM-DD", comparar con < funciona
        if (fecha < fechaDeHoy()) {

            return respuesta.status(400).json({
                mensaje: "No puedes agendar citas en fechas pasadas"
            });

        }

        if (!HORAS_VALIDAS.includes(hora)) {

            return respuesta.status(400).json({
                mensaje:
                    "Hora no válida. Horas disponibles: " +
                    HORAS_VALIDAS.join(", ")
            });

        }


        try {

            let pacienteId;
            let doctorId;
            let origen;

            if (peticion.usuario.rol === "paciente") {

                // La identidad sale del TOKEN, no del cuerpo
                pacienteId =
                    await obtenerPacienteId(peticion.usuario.id);

                doctorId = Number(peticion.body.doctorId);

                origen = "app";

            } else {

                doctorId =
                    await obtenerDoctorId(peticion.usuario.id);

                pacienteId = Number(peticion.body.pacienteId);

                origen = "manual";

            }

            if (
                !Number.isInteger(pacienteId) ||
                !Number.isInteger(doctorId)
            ) {

                return respuesta.status(400).json({
                    mensaje: "Falta indicar el doctor o el paciente"
                });

            }


            const resultado = await pool.query(
                "INSERT INTO citas " +
                "(paciente_id, doctor_id, fecha, hora, origen, motivo) " +
                "VALUES ($1, $2, $3, $4, $5, $6) " +
                "RETURNING id, paciente_id, doctor_id, fecha, " +
                "to_char(hora, 'HH24:MI') AS hora, estado, origen, motivo",
                [pacienteId, doctorId, fecha, hora, origen, motivo || null]
            );

            respuesta.status(201).json(resultado.rows[0]);

        } catch (error) {

            // 23505: violó el índice anti doble reserva
            if (error.code === "23505") {

                return respuesta.status(409).json({
                    mensaje: "Ese horario ya está ocupado para ese doctor"
                });

            }

            // 23503: el doctor o el paciente no existe (clave foránea)
            if (error.code === "23503") {

                return respuesta.status(400).json({
                    mensaje: "El doctor o el paciente indicado no existe"
                });

            }

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al crear la cita"
            });

        }

    }
);


// ========================================
// GET /api/citas
// Lista SOLO las citas del usuario que consulta
// ========================================
// Doctores: se puede filtrar por día  ->  /api/citas?fecha=2026-11-10
// ========================================

router.get(
    "/",
    verificarToken,
    soloRoles("paciente", "doctor"),
    async function(peticion, respuesta) {

        try {

            const parametros = [];

            // La estructura del SQL la armamos con texto fijo;
            // los VALORES siempre van como parámetros ($1, $2...)
            let sql =
                "SELECT c.id, c.fecha, " +
                "to_char(c.hora, 'HH24:MI') AS hora, " +
                "c.estado, c.origen, c.motivo, " +
                "p.nombre AS paciente, d.nombre AS doctor, " +
                "d.especialidad " +
                "FROM citas c " +
                "JOIN pacientes p ON p.id = c.paciente_id " +
                "JOIN doctores d ON d.id = c.doctor_id " +
                "WHERE ";


            if (peticion.usuario.rol === "paciente") {

                const pacienteId =
                    await obtenerPacienteId(peticion.usuario.id);

                if (pacienteId === null) {

                    return respuesta.status(404).json({
                        mensaje: "No se encontró tu perfil de paciente"
                    });

                }

                sql = sql + "c.paciente_id = $1";

                parametros.push(pacienteId);

            } else {

                const doctorId =
                    await obtenerDoctorId(peticion.usuario.id);

                if (doctorId === null) {

                    return respuesta.status(404).json({
                        mensaje: "No se encontró tu perfil de doctor"
                    });

                }

                sql = sql + "c.doctor_id = $1";

                parametros.push(doctorId);


                // Filtro opcional por día
                const fecha = peticion.query.fecha;

                if (fecha !== undefined) {

                    if (!fechaValida(String(fecha))) {

                        return respuesta.status(400).json({
                            mensaje: "La fecha debe tener el formato AAAA-MM-DD"
                        });

                    }

                    sql = sql + " AND c.fecha = $2";

                    parametros.push(fecha);

                }

            }


            sql = sql + " ORDER BY c.fecha, c.hora";

            const resultado = await pool.query(sql, parametros);

            respuesta.json(resultado.rows);

        } catch (error) {

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al obtener las citas"
            });

        }

    }
);


// ========================================
// PATCH /api/citas/:id/cancelar
// Solo el paciente o el doctor DUEÑOS de la cita
// ========================================

router.patch(
    "/:id/cancelar",
    verificarToken,
    soloRoles("paciente", "doctor"),
    async function(peticion, respuesta) {

        const id = Number(peticion.params.id);

        if (!Number.isInteger(id)) {

            return respuesta.status(400).json({
                mensaje: "El id debe ser un número"
            });

        }


        try {

            const busqueda = await pool.query(
                "SELECT id, paciente_id, doctor_id, estado " +
                "FROM citas WHERE id = $1",
                [id]
            );

            const cita = busqueda.rows[0];

            if (!cita) {

                return respuesta.status(404).json({
                    mensaje: "Cita no encontrada"
                });

            }


            // ---------- ¿Es suya esta cita? ----------

            let esDueno = false;

            if (peticion.usuario.rol === "paciente") {

                const pacienteId =
                    await obtenerPacienteId(peticion.usuario.id);

                esDueno = (cita.paciente_id === pacienteId);

            } else {

                const doctorId =
                    await obtenerDoctorId(peticion.usuario.id);

                esDueno = (cita.doctor_id === doctorId);

            }

            if (!esDueno) {

                return respuesta.status(403).json({
                    mensaje: "No tienes permiso para modificar esta cita"
                });

            }


            // ---------- ¿Se puede cancelar en su estado actual? ----------

            if (
                cita.estado !== "Pendiente" &&
                cita.estado !== "Confirmada"
            ) {

                return respuesta.status(409).json({
                    mensaje:
                        "Una cita en estado " + cita.estado +
                        " ya no se puede cancelar"
                });

            }


            const resultado = await pool.query(
                "UPDATE citas SET estado = 'Cancelada' " +
                "WHERE id = $1 RETURNING id, estado",
                [id]
            );

            respuesta.json(resultado.rows[0]);

        } catch (error) {

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al cancelar la cita"
            });

        }

    }
);


module.exports = router;