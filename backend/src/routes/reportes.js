// ========================================
// RUTAS DE REPORTES
// ========================================

const express = require("express");
const pool = require("../db");
const { verificarToken, soloRoles } = require("../middlewares/auth");
const { fechaValida, fechaDeHoy } = require("../utils/fechas");

const router = express.Router();


// Redondea un número a cierta cantidad de decimales
function redondear(numero, decimales) {

    const factor = Math.pow(10, decimales);

    return Math.round(numero * factor) / factor;

}


// ========================================
// GET /api/reportes/diario?fecha=AAAA-MM-DD
// ========================================
// - Doctor: el reporte de SUS citas
// - Administrador: el reporte de TODA la clínica
// Si no se indica fecha, se usa la de hoy.
// ========================================

router.get(
    "/diario",
    verificarToken,
    soloRoles("doctor", "admin"),
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

            // $1 siempre es la fecha. Si es doctor, se agrega $2
            // con su id para filtrar solo sus citas.
            const parametros = [fecha];

            let filtroDoctor = "";

            let nombreDoctor = null;

            if (peticion.usuario.rol === "doctor") {

                const doctor = await pool.query(
                    "SELECT id, nombre FROM doctores WHERE usuario_id = $1",
                    [peticion.usuario.id]
                );

                if (doctor.rows.length === 0) {

                    return respuesta.status(404).json({
                        mensaje: "No se encontró tu perfil de doctor"
                    });

                }

                parametros.push(doctor.rows[0].id);

                filtroDoctor = " AND doctor_id = $2";

                nombreDoctor = doctor.rows[0].nombre;

            }


            // Las 4 consultas son independientes: se lanzan juntas
            const consultas = await Promise.all([

                // 0) Resumen general
                pool.query(
                    "SELECT " +
                    "COUNT(*)::int AS total, " +
                    "(COUNT(*) FILTER (WHERE estado = 'Completada'))::int " +
                    "AS completadas, " +
                    "(COUNT(*) FILTER (WHERE estado = 'Cancelada'))::int " +
                    "AS canceladas, " +
                    "(COUNT(*) FILTER (WHERE estado = 'No asistio'))::int " +
                    "AS no_asistio, " +
                    "(COUNT(*) FILTER (WHERE estado IN " +
                    "('Pendiente', 'Confirmada', 'En sala', 'En consulta')))::int " +
                    "AS pendientes, " +
                    "(COUNT(*) FILTER (WHERE origen = 'app'))::int AS por_app, " +
                    "(COUNT(*) FILTER (WHERE origen = 'manual'))::int " +
                    "AS manuales, " +
                    "(COUNT(DISTINCT paciente_id) FILTER " +
                    "(WHERE estado = 'Completada'))::int " +
                    "AS pacientes_atendidos, " +
                    "(COUNT(*) FILTER (WHERE pagado_en IS NOT NULL))::int " +
                    "AS cobradas, " +
                    "COALESCE(SUM(monto), 0)::float AS ingresos, " +
                    "COALESCE(AVG(EXTRACT(EPOCH FROM " +
                    "(hora_inicio - hora_llegada)) / 60), 0)::float " +
                    "AS espera_promedio, " +
                    "COALESCE(AVG(EXTRACT(EPOCH FROM " +
                    "(hora_fin - hora_inicio)) / 60), 0)::float " +
                    "AS consulta_promedio " +
                    "FROM citas WHERE fecha = $1" + filtroDoctor,
                    parametros
                ),

                // 1) Ingresos por método de pago
                pool.query(
                    "SELECT metodo_pago, COUNT(*)::int AS cantidad, " +
                    "SUM(monto)::float AS total " +
                    "FROM citas " +
                    "WHERE fecha = $1 AND pagado_en IS NOT NULL" +
                    filtroDoctor +
                    " GROUP BY metodo_pago ORDER BY total DESC",
                    parametros
                ),

                // 2) Citas por hora (para ver las horas pico)
                pool.query(
                    "SELECT to_char(hora, 'HH24:MI') AS hora, " +
                    "COUNT(*)::int AS cantidad " +
                    "FROM citas " +
                    "WHERE fecha = $1 AND estado <> 'Cancelada'" +
                    filtroDoctor +
                    " GROUP BY hora ORDER BY hora",
                    parametros
                ),

                // 3) Desglose por doctor (solo para el administrador)
                peticion.usuario.rol === "admin"
                    ? pool.query(
                        "SELECT d.nombre AS doctor, COUNT(*)::int AS citas, " +
                        "COALESCE(SUM(c.monto), 0)::float AS ingresos " +
                        "FROM citas c " +
                        "JOIN doctores d ON d.id = c.doctor_id " +
                        "WHERE c.fecha = $1 " +
                        "GROUP BY d.id, d.nombre ORDER BY ingresos DESC",
                        [fecha]
                    )
                    : Promise.resolve({ rows: [] })

            ]);

            const r = consultas[0].rows[0];


            respuesta.json({

                fecha: fecha,

                alcance:
                    peticion.usuario.rol === "doctor" ? "doctor" : "clinica",

                doctor: nombreDoctor,

                generadoEn: new Date().toISOString(),

                resumen: {

                    totalCitas: r.total,

                    completadas: r.completadas,

                    canceladas: r.canceladas,

                    noAsistio: r.no_asistio,

                    pendientes: r.pendientes,

                    porApp: r.por_app,

                    manuales: r.manuales,

                    pacientesAtendidos: r.pacientes_atendidos,

                    citasCobradas: r.cobradas,

                    ingresosTotal: redondear(r.ingresos, 2),

                    ticketPromedio:
                        r.cobradas > 0
                            ? redondear(r.ingresos / r.cobradas, 2)
                            : 0,

                    esperaPromedioMin: redondear(r.espera_promedio, 1),

                    consultaPromedioMin: redondear(r.consulta_promedio, 1)

                },

                citasPorEstado: [

                    { estado: "Completadas", cantidad: r.completadas },

                    { estado: "Pendientes", cantidad: r.pendientes },

                    { estado: "Canceladas", cantidad: r.canceladas },

                    { estado: "No asistió", cantidad: r.no_asistio }

                ],

                ingresosPorMetodo: consultas[1].rows,

                citasPorHora: consultas[2].rows,

                porDoctor: consultas[3].rows

            });

        } catch (error) {

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al generar el reporte"
            });

        }

    }
);


module.exports = router;