// ========================================
// RUTAS DE PACIENTES
// ========================================

const express = require("express");
const pool = require("../db");
const { verificarToken, soloRoles } = require("../middlewares/auth");
const { fechaValida, fechaDeHoy } = require("../utils/fechas");

const router = express.Router();


const TIPOS_SANGRE = [
    "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-",
    "No sé / No aplica"
];

const PARENTESCOS = [
    "Padre", "Madre", "Hermano(a)", "Esposo(a)",
    "Hijo(a)", "Amigo(a)", "Otro"
];


// Deja solo los números de un teléfono: "(555) 123-4567" -> "5551234567"
function soloDigitos(texto) {

    return String(texto || "").replace(/\D/g, "");

}


// Consulta que devuelve el perfil completo del paciente
// (el $1 es el id del USUARIO que inició sesión)
const SQL_PERFIL =
    "SELECT p.id, p.nombre, u.correo, p.telefono, p.documento, " +
    "p.fecha_nacimiento, p.direccion, p.alergias, p.tipo_sangre, " +
    "p.contacto_emergencia_nombre, p.contacto_emergencia_parentesco, " +
    "p.contacto_emergencia_telefono " +
    "FROM pacientes p " +
    "JOIN usuarios u ON u.id = p.usuario_id " +
    "WHERE p.usuario_id = $1";


// Convierte una fila de la base en el perfil que devolvemos
function armarPerfil(fila) {

    return {

        id: fila.id,

        nombre: fila.nombre,

        correo: fila.correo,

        telefono: fila.telefono,

        documento: fila.documento,

        fechaNacimiento: fila.fecha_nacimiento,

        direccion: fila.direccion,

        alergias: fila.alergias,

        tipoSangre: fila.tipo_sangre,

        contactoEmergencia: {

            nombre: fila.contacto_emergencia_nombre,

            parentesco: fila.contacto_emergencia_parentesco,

            telefono: fila.contacto_emergencia_telefono

        }

    };

}


// ========================================
// GET /api/pacientes/yo
// El perfil del paciente que inició sesión
// ========================================

router.get(
    "/yo",
    verificarToken,
    soloRoles("paciente"),
    async function(peticion, respuesta) {

        try {

            const resultado =
                await pool.query(SQL_PERFIL, [peticion.usuario.id]);

            if (resultado.rows.length === 0) {

                return respuesta.status(404).json({
                    mensaje: "No se encontró tu perfil de paciente"
                });

            }

            respuesta.json(armarPerfil(resultado.rows[0]));

        } catch (error) {

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al obtener el perfil"
            });

        }

    }
);


// ========================================
// PUT /api/pacientes/yo
// Guarda el perfil completo del paciente
// ========================================
// El documento y el correo NO se pueden cambiar desde aquí.
// ========================================

router.put(
    "/yo",
    verificarToken,
    soloRoles("paciente"),
    async function(peticion, respuesta) {

        const cuerpo = peticion.body;

        const nombre = String(cuerpo.nombre || "").trim();

        const telefono = String(cuerpo.telefono || "").trim();

        const direccion = String(cuerpo.direccion || "").trim();

        const alergias = String(cuerpo.alergias || "").trim();

        const tipoSangre = String(cuerpo.tipoSangre || "").trim();

        const fechaNacimiento =
            String(cuerpo.fechaNacimiento || "").trim();

        const emergencia = cuerpo.contactoEmergencia || {};

        const emergenciaNombre =
            String(emergencia.nombre || "").trim();

        const emergenciaParentesco =
            String(emergencia.parentesco || "").trim();

        const emergenciaTelefono =
            String(emergencia.telefono || "").trim();


        // ---------- Validaciones ----------

        if (nombre === "") {

            return respuesta.status(400).json({
                mensaje: "El nombre es obligatorio"
            });

        }

        if (
            nombre.length > 120 ||
            telefono.length > 30 ||
            direccion.length > 300 ||
            alergias.length > 500 ||
            emergenciaNombre.length > 120 ||
            emergenciaTelefono.length > 30
        ) {

            return respuesta.status(400).json({
                mensaje: "Alguno de los textos es demasiado largo"
            });

        }

        if (tipoSangre !== "" && !TIPOS_SANGRE.includes(tipoSangre)) {

            return respuesta.status(400).json({
                mensaje: "El tipo de sangre no es válido"
            });

        }

        if (
            emergenciaParentesco !== "" &&
            !PARENTESCOS.includes(emergenciaParentesco)
        ) {

            return respuesta.status(400).json({
                mensaje: "El parentesco no es válido"
            });

        }

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

        // El teléfono de emergencia no puede ser el mismo que el
        // personal (se comparan solo los dígitos)
        if (
            emergenciaTelefono !== "" &&
            soloDigitos(emergenciaTelefono) !== "" &&
            soloDigitos(emergenciaTelefono) === soloDigitos(telefono)
        ) {

            return respuesta.status(400).json({
                mensaje:
                    "El teléfono de emergencia no puede ser el mismo " +
                    "que tu teléfono personal"
            });

        }


        try {

            const actualizacion = await pool.query(
                "UPDATE pacientes SET " +
                "nombre = $1, telefono = $2, direccion = $3, " +
                "alergias = $4, tipo_sangre = $5, fecha_nacimiento = $6, " +
                "contacto_emergencia_nombre = $7, " +
                "contacto_emergencia_parentesco = $8, " +
                "contacto_emergencia_telefono = $9 " +
                "WHERE usuario_id = $10 RETURNING id",
                [
                    nombre,
                    telefono || null,
                    direccion || null,
                    alergias || null,
                    tipoSangre || null,
                    fechaNacimiento || null,
                    emergenciaNombre || null,
                    emergenciaParentesco || null,
                    emergenciaTelefono || null,
                    peticion.usuario.id
                ]
            );

            if (actualizacion.rowCount === 0) {

                return respuesta.status(404).json({
                    mensaje: "No se encontró tu perfil de paciente"
                });

            }

            // Devolvemos el perfil ya guardado
            const resultado =
                await pool.query(SQL_PERFIL, [peticion.usuario.id]);

            respuesta.json(armarPerfil(resultado.rows[0]));

        } catch (error) {

            console.error(error);

            respuesta.status(500).json({
                mensaje: "Error al guardar el perfil"
            });

        }

    }
);


// ========================================
// POST /api/pacientes
// Registra un paciente que NO usa la app (recepción)
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

        if (
            nombre.length > 120 ||
            telefono.length > 30 ||
            documento.length > 30
        ) {

            return respuesta.status(400).json({
                mensaje: "Alguno de los textos es demasiado largo"
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
// Busca por nombre, documento o teléfono (recepción)
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