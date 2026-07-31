// ========================================
// MEDICITAS - DATOS COMPARTIDOS
// ========================================
// Este archivo maneja el almacenamiento de
// usuarios, la sesión activa y las citas.
// Lo usan: registro.html, login.html y
// dashboard-paciente.html
// ========================================


// ========================================
// USUARIOS
// ========================================

function obtenerUsuarios() {

    return (
        JSON.parse(
            localStorage.getItem("medicitas_usuarios")
        ) || []
    );

}


function guardarUsuarios(usuarios) {

    localStorage.setItem(
        "medicitas_usuarios",
        JSON.stringify(usuarios)
    );

}


// ========================================
// SESIÓN ACTIVA
// ========================================

function guardarSesion(usuarioId) {

    localStorage.setItem(
        "medicitas_sesion",
        JSON.stringify({ usuarioId: usuarioId })
    );

}


function obtenerUsuarioSesion() {

    const sesion =
        JSON.parse(
            localStorage.getItem("medicitas_sesion")
        );


    if (!sesion) {

        return null;

    }


    const usuarios =
        obtenerUsuarios();


    const usuario =
        usuarios.find(function(usuario) {

            return usuario.id === sesion.usuarioId;

        });


    return usuario || null;

}


function cerrarSesion() {

    localStorage.removeItem("medicitas_sesion");

    window.location.href = "login.html";

}


// ========================================
// CITAS
// ========================================

function obtenerCitasMedicitas() {

    return (
        JSON.parse(
            localStorage.getItem("medicitas_citas")
        ) || []
    );

}


function guardarCitasMedicitas(citas) {

    localStorage.setItem(
        "medicitas_citas",
        JSON.stringify(citas)
    );

}


// ========================================
// NOTIFICACIONES
// ========================================

function obtenerNotificaciones() {

    return (
        JSON.parse(
            localStorage.getItem("medicitas_notificaciones")
        ) || []
    );

}


function guardarNotificaciones(notificaciones) {

    localStorage.setItem(
        "medicitas_notificaciones",
        JSON.stringify(notificaciones)
    );

}


function crearNotificacion(usuarioId, mensaje) {

    const notificaciones =
        obtenerNotificaciones();

    notificaciones.push({

        id: Date.now(),

        usuarioId: usuarioId,

        mensaje: mensaje,

        leida: false

    });

    guardarNotificaciones(notificaciones);

}