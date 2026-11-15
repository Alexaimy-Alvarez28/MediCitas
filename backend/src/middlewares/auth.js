
const jwt = require("jsonwebtoken");
const pool = require("../db");

// ========================================
// VERIFICAR TOKEN Y ESTADO DE LA CUENTA
// ========================================

async function verificarToken(peticion, respuesta, siguiente) {

    const cabecera = peticion.headers.authorization || "";
    const partes = cabecera.split(" ");

    const tipo = partes[0];
    const token = partes[1];

    if (tipo !== "Bearer" || !token || partes.length !== 2) {
        return respuesta.status(401).json({
            mensaje: "Debes iniciar sesión"
        });
    }

    let datos;

    try {
        datos = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return respuesta.status(401).json({
            mensaje: "Sesión inválida o expirada"
        });
    }

    if (!datos.id || !Number.isInteger(Number(datos.id))) {
        return respuesta.status(401).json({
            mensaje: "Sesión inválida"
        });
    }

    try {

        // Consultar la cuenta en cada petición protegida
        const resultado = await pool.query(
            `SELECT id, correo, rol, activo
             FROM usuarios
             WHERE id = $1`,
            [datos.id]
        );

        if (resultado.rows.length === 0) {
            return respuesta.status(401).json({
                mensaje: "La cuenta ya no existe"
            });
        }

        const usuario = resultado.rows[0];

        // Impedir el acceso a cuentas desactivadas
        if (!usuario.activo) {
            return respuesta.status(403).json({
                mensaje: "Tu cuenta está desactivada. Contacta al administrador."
            });
        }

        // El rol se obtiene de la base de datos,
        // no del rol antiguo guardado en el token.
        peticion.usuario = {
            id: usuario.id,
            correo: usuario.correo,
            rol: usuario.rol
        };

        siguiente();

    } catch (error) {

        console.error("Error al verificar la cuenta:", error);

        return respuesta.status(500).json({
            mensaje: "No se pudo verificar la cuenta"
        });

    }
}

// ========================================
// VERIFICAR PERMISOS POR ROL
// ========================================

function soloRoles(...rolesPermitidos) {

    return function(peticion, respuesta, siguiente) {

        if (!peticion.usuario) {
            return respuesta.status(401).json({
                mensaje: "Debes iniciar sesión"
            });
        }

        if (!rolesPermitidos.includes(peticion.usuario.rol)) {
            return respuesta.status(403).json({
                mensaje: "No tienes permiso para esta acción"
            });
        }

        siguiente();

    };

}

module.exports = {
    verificarToken,
    soloRoles
};
