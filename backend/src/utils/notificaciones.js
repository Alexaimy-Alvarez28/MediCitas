// ========================================
// AVISOS (NOTIFICACIONES) AUTOMÁTICOS
// ========================================
// Cada función recibe el id de una cita, arma el mensaje
// con sus datos y lo guarda para quien corresponda.
//
// Si algo falla aquí, se registra el error pero NO se
// interrumpe la operación principal (cancelar, confirmar...).
// ========================================

const pool = require("../db");


// "2026-11-12" -> "12/11/2026"
function formatearFecha(fecha) {

    return String(fecha).split("-").reverse().join("/");

}


async function crearNotificacion(usuarioId, mensaje) {

    await pool.query(
        "INSERT INTO notificaciones (usuario_id, mensaje) VALUES ($1, $2)",
        [usuarioId, mensaje]
    );

}


// Trae lo necesario de la cita para armar el mensaje
async function obtenerDatosCita(citaId) {

    const resultado = await pool.query(
        "SELECT c.fecha, to_char(c.hora, 'HH24:MI') AS hora, " +
        "d.nombre AS doctor, d.especialidad, " +
        "d.usuario_id AS doctor_usuario_id, " +
        "p.nombre AS paciente, " +
        "p.usuario_id AS paciente_usuario_id " +
        "FROM citas c " +
        "JOIN doctores d ON d.id = c.doctor_id " +
        "JOIN pacientes p ON p.id = c.paciente_id " +
        "WHERE c.id = $1",
        [citaId]
    );

    return resultado.rows[0] || null;

}


// Función general: busca la cita, decide a quién avisar y guarda
// el mensaje que arme la función "armarMensaje"
async function notificar(citaId, destinatario, armarMensaje) {

    try {

        const cita = await obtenerDatosCita(citaId);

        if (!cita) {

            return;

        }

        const usuarioId =
            destinatario === "paciente"
                ? cita.paciente_usuario_id
                : cita.doctor_usuario_id;

        // Pacientes registrados por recepción no tienen cuenta:
        // no hay a quién avisar
        if (usuarioId === null) {

            return;

        }

        await crearNotificacion(usuarioId, armarMensaje(cita));

    } catch (error) {

        console.error("No se pudo crear la notificación:", error);

    }

}


// ---------- Avisos al PACIENTE ----------

function notificarCitaConfirmada(citaId) {

    return notificar(citaId, "paciente", function(cita) {

        return (
            "Tu cita de " + cita.especialidad +
            " con el Dr(a). " + cita.doctor +
            " el " + formatearFecha(cita.fecha) +
            " a las " + cita.hora +
            " ha sido confirmada."
        );

    });

}


function notificarCitaCanceladaPorDoctor(citaId) {

    return notificar(citaId, "paciente", function(cita) {

        return (
            "Tu cita de " + cita.especialidad +
            " con el Dr(a). " + cita.doctor +
            " el " + formatearFecha(cita.fecha) +
            " a las " + cita.hora +
            " ha sido cancelada por el doctor."
        );

    });

}


// ---------- Avisos al DOCTOR ----------

function notificarNuevaCita(citaId) {

    return notificar(citaId, "doctor", function(cita) {

        return (
            "Nueva cita pendiente de confirmar: " + cita.paciente +
            " el " + formatearFecha(cita.fecha) +
            " a las " + cita.hora + "."
        );

    });

}


function notificarCitaCanceladaPorPaciente(citaId) {

    return notificar(citaId, "doctor", function(cita) {

        return (
            "El paciente " + cita.paciente +
            " canceló su cita de " + cita.especialidad +
            " del " + formatearFecha(cita.fecha) +
            " a las " + cita.hora + "."
        );

    });

}


module.exports = {

    notificarCitaConfirmada,

    notificarCitaCanceladaPorDoctor,

    notificarNuevaCita,

    notificarCitaCanceladaPorPaciente

};