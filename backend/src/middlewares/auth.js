const jwt = require("jsonwebtoken");

function verificarToken(peticion, respuesta, siguiente) {

    const cabecera = peticion.headers.authorization || "";

    const partes = cabecera.split(" ");

    const tipo = partes[0];

    const token = partes[1];


    if (tipo !== "Bearer" || !token) {

        return respuesta.status(401).json({
            mensaje: "Debes iniciar sesión"
        });

    }


    try {

        const datos = jwt.verify(token, process.env.JWT_SECRET);

        peticion.usuario = {
            id: datos.id,
            rol: datos.rol
        };

        siguiente();

    } catch (error) {

        return respuesta.status(401).json({
            mensaje: "Sesión inválida o expirada"
        });

    }

}


function soloRoles(...rolesPermitidos) {

    return function(peticion, respuesta, siguiente) {

        if (!rolesPermitidos.includes(peticion.usuario.rol)) {

            return respuesta.status(403).json({
                mensaje: "No tienes permiso para esta acción"
            });

        }

        siguiente();

    };

}


module.exports = { verificarToken, soloRoles };