// ========================================
// RUTAS DE CITAS
// ========================================

const express = require("express");
const pool = require("../db");
const { verificarToken, soloRoles } = require("../middlewares/auth");
const { fechaValida, fechaDeHoy } = require("../utils/fechas");
const { HORAS_VALIDAS } = require("../utils/horarios");
const {
    notificarCitaConfirmada,
    notificarCitaCanceladaPorDoctor,
    notificarNuevaCita,
    notificarCitaCanceladaPorPaciente
} = require("../utils/notificaciones");

const router = express.Router();


// ========================================
// MÁQUINA DE ESTADOS
// ========================================
// Para cada estado actual, a cuáles se puede pasar.
// ========================================

const TRANSICIONES = {

    "Pendiente": ["Confirmada", "Cancelada"],

    "Confirmada": ["En sala", "No asistio", "Cancelada"],

    "En sala": ["En consulta", "Cancelada"],

    "En consulta": ["Completada"],

    "Completada": [],

    "Cancelada": [],

    "No asistio": []

};


// Al entrar a estos estados se guarda la hora exacta.
// Es un mapa FIJO nuestro (los nombres de columna no pueden
// ir como parámetro, y nunca se usa nada que venga del cliente).
const COLUMNA_TIEMPO = {

    "En sala": "hora_llegada",

    "En consulta": "hora_inicio",

    "Completada": "hora_fin"

};


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

        if (motivo.length > 500) {

            return respuesta.status(400).json({
                mensaje: "El motivo es demasiado largo (máximo 500 caracteres)"
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

            const cita = resultado.rows[0];

            // Si la agendó el paciente, el doctor debe enterarse
            if (origen === "app") {

                await notificarNuevaCita(cita.id);

            }

            respuesta.status(201).json(cita);

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
// GET /api/citas/cola?fecha=AAAA-MM-DD
// La cola de espera del día de ESTE doctor
// ========================================
// Si no se indica fecha, se usa la de hoy.
// ========================================

router.get(
    "/cola",
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

            const doctorId =
                await obtenerDoctorId(peticion.usuario.id);

            if (doctorId === null) {

                return respuesta.status(404).json({
                    mensaje: "No se encontró tu perfil de doctor"
                });

            }


            // ROW_NUMBER numera a los pacientes que están en sala
            // según su hora de llegada: ese es su turno.
            const resultado = await pool.query(
                "SELECT c.id, c.estado, " +
                "to_char(c.hora, 'HH24:MI') AS hora, " +
                "c.origen, c.motivo, p.nombre AS paciente, " +
                "c.hora_llegada, c.hora_inicio, " +
                "CASE WHEN c.estado = 'En sala' THEN " +
                "(ROW_NUMBER() OVER (PARTITION BY c.estado " +
                "ORDER BY c.hora_llegada))::int END AS turno, " +
                "CASE WHEN c.estado = 'En sala' THEN " +
                "(EXTRACT(EPOCH FROM (NOW() - c.hora_llegada)) / 60)::int " +
                "END AS minutos_espera " +
                "FROM citas c " +
                "JOIN pacientes p ON p.id = c.paciente_id " +
                "WHERE c.doctor_id = $1 AND c.fecha = $2 " +
                "AND c.estado IN " +
                "('Pendiente', 'Confirmada', 'En sala', 'En consulta') " +
                "ORDER BY c.hora",
                [doctorId, fecha]
            );

            const filas = resultado.rows;

            respuesta.json({

                fecha: fecha,

                enConsulta:
                    filas.find(function(fila) {

                        return fila.estado === "En consulta";

                    }) || null,

                enEspera:
                    filas.filter(function(fila) {

                        return fila.estado === "En sala";

                    }).sort(function(a, b) {

                        return a.turno - b.turno;

                    }),

                porLlegar:
                    filas.filter(function(fila) {

                        return fila.estado === "Confirmada";

                    }),

                pendientesDeConfirmar:
                    filas.filter(function(fila) {

                        return fila.estado === "Pendiente";

                    })

            });

        } catch (error) {

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al obtener la cola"
            });

        }

    }
);


// ========================================
// PATCH /api/citas/:id/estado
// Mueve la cita por el flujo (doctor / recepción)
// ========================================
// Body: { "estado": "Confirmada" }
// ========================================

router.patch(
    "/:id/estado",
    verificarToken,
    soloRoles("doctor"),
    async function(peticion, respuesta) {

        const id = Number(peticion.params.id);

        if (!Number.isInteger(id)) {

            return respuesta.status(400).json({
                mensaje: "El id debe ser un número"
            });

        }

        const nuevoEstado =
            String(peticion.body.estado || "").trim();

        if (!Object.prototype.hasOwnProperty.call(TRANSICIONES, nuevoEstado)) {

            return respuesta.status(400).json({
                mensaje: "Estado no válido"
            });

        }


        try {

            const doctorId =
                await obtenerDoctorId(peticion.usuario.id);

            const busqueda = await pool.query(
                "SELECT id, doctor_id, estado FROM citas WHERE id = $1",
                [id]
            );

            const cita = busqueda.rows[0];

            if (!cita) {

                return respuesta.status(404).json({
                    mensaje: "Cita no encontrada"
                });

            }

            // Solo el doctor dueño de la cita puede moverla
            if (cita.doctor_id !== doctorId) {

                return respuesta.status(403).json({
                    mensaje: "No tienes permiso para modificar esta cita"
                });

            }

            // ¿Esa transición está permitida?
            if (!TRANSICIONES[cita.estado].includes(nuevoEstado)) {

                return respuesta.status(409).json({
                    mensaje:
                        "No se puede pasar de " + cita.estado +
                        " a " + nuevoEstado
                });

            }


            // Armamos el UPDATE: si el nuevo estado guarda una hora,
            // agregamos esa columna (sale de nuestro mapa fijo)
            let sql = "UPDATE citas SET estado = $1";

            const columna = COLUMNA_TIEMPO[nuevoEstado];

            if (columna) {

                sql = sql + ", " + columna + " = NOW()";

            }

            // "AND estado = $3": si alguien cambió la cita justo
            // antes que nosotros, este UPDATE no encuentra fila
            sql = sql +
                " WHERE id = $2 AND estado = $3" +
                " RETURNING id, estado, hora_llegada, hora_inicio, hora_fin";

            const resultado = await pool.query(
                sql,
                [nuevoEstado, id, cita.estado]
            );

            if (resultado.rowCount === 0) {

                return respuesta.status(409).json({
                    mensaje:
                        "La cita cambió de estado mientras la " +
                        "modificabas. Actualiza la lista."
                });

            }


            // Avisos al paciente (si tiene cuenta en la app)
            if (nuevoEstado === "Confirmada") {

                await notificarCitaConfirmada(id);

            } else if (nuevoEstado === "Cancelada") {

                await notificarCitaCanceladaPorDoctor(id);

            }

            respuesta.json(resultado.rows[0]);

        } catch (error) {

            // 23505: el índice "una_consulta_a_la_vez" lo rechazó
            if (error.code === "23505") {

                return respuesta.status(409).json({
                    mensaje:
                        "Ya tienes un paciente en consulta. " +
                        "Complétala antes de iniciar otra."
                });

            }

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al cambiar el estado de la cita"
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
                "WHERE id = $1 AND estado = $2 RETURNING id, estado",
                [id, cita.estado]
            );

            if (resultado.rowCount === 0) {

                return respuesta.status(409).json({
                    mensaje:
                        "La cita cambió de estado mientras la " +
                        "modificabas. Actualiza la lista."
                });

            }


            // Avisamos a la otra parte
            if (peticion.usuario.rol === "paciente") {

                await notificarCitaCanceladaPorPaciente(id);

            } else {

                await notificarCitaCanceladaPorDoctor(id);

            }

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