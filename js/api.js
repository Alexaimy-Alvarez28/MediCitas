// ========================================
// MEDICITAS - CLIENTE DE LA API (COMPARTIDO)
// ========================================
// Lo usan todas las páginas que hablan con el backend:
// login, registro y los paneles.
// ========================================


// Dirección de la API (el backend)
const API = "http://localhost:3000/api";

// A qué página va cada rol después de iniciar sesión.
// (Temporal: el panel del doctor y el del administrador se
// conectan en las próximas lecciones; mientras tanto, ambos
// usan la página del reporte.)
const PANEL_POR_ROL = {

    paciente: "dashboard-paciente.html",

    doctor: "reporte-diario.html",

    admin: "reporte-diario.html"

};


// ========================================
// SESIÓN (se guarda en sessionStorage)
// ========================================
// sessionStorage se borra al cerrar la pestaña y no se
// comparte entre pestañas.
// ========================================

function obtenerToken() {

    return sessionStorage.getItem("medicitas_token");

}


function obtenerUsuarioGuardado() {

    try {

        return JSON.parse(sessionStorage.getItem("medicitas_usuario"));

    } catch (error) {

        return null;

    }

}


function guardarSesion(token, usuario) {

    sessionStorage.setItem("medicitas_token", token);

    sessionStorage.setItem("medicitas_usuario", JSON.stringify(usuario));

}


// Borra la sesión y vuelve al login. Si se indica un mensaje,
// el login lo mostrará.
function cerrarSesion(mensaje) {

    sessionStorage.removeItem("medicitas_token");

    sessionStorage.removeItem("medicitas_usuario");

    if (mensaje) {

        sessionStorage.setItem("medicitas_aviso", mensaje);

    }

    window.location.href = "login.html";

}


// ========================================
// LLAMADAS A LA API
// ========================================

// Un error con el mensaje que mandó la API y su código de estado
class ErrorApi extends Error {

    constructor(mensaje, estado) {

        super(mensaje);

        this.estado = estado;

    }

}


// Ejemplos:
//   const doctores = await llamarApi("/doctores");
//   await llamarApi("/citas", { metodo: "POST", cuerpo: { ... } });
async function llamarApi(ruta, opciones) {

    const config = opciones || {};

    const cabeceras = { "Content-Type": "application/json" };

    const token = obtenerToken();

    if (token) {

        cabeceras["Authorization"] = "Bearer " + token;

    }


    let respuesta;

    try {

        respuesta = await fetch(API + ruta, {

            method: config.metodo || "GET",

            headers: cabeceras,

            body:
                config.cuerpo !== undefined
                    ? JSON.stringify(config.cuerpo)
                    : undefined

        });

    } catch (error) {

        // Sin conexión, servidor apagado o bloqueo de CORS
        throw new ErrorApi(
            "No se pudo conectar con el servidor. " +
            "Revisa que esté encendido.",
            0
        );

    }


    let datos = null;

    try {

        datos = await respuesta.json();

    } catch (error) {

        datos = null;

    }


    if (!respuesta.ok) {

        // 401 teniendo sesión guardada: el token venció
        if (respuesta.status === 401 && token) {

            cerrarSesion("Tu sesión expiró. Inicia sesión de nuevo.");

        }

        throw new ErrorApi(
            (datos && datos.mensaje) || "Ocurrió un error.",
            respuesta.status
        );

    }

    return datos;

}


// ========================================
// MENSAJES EN PANTALLA (reemplazan a alert)
// ========================================
// tipo: "exito", "error" o "info"
// ========================================

let temporizadorMensaje = null;

function mostrarMensaje(texto, tipo) {

    let caja = document.getElementById("mensajeGlobal");

    if (!caja) {

        caja = document.createElement("div");

        caja.id = "mensajeGlobal";

        document.body.appendChild(caja);

    }

    caja.className = "mensaje-global mensaje-" + (tipo || "info");

    caja.textContent = texto;

    clearTimeout(temporizadorMensaje);

    temporizadorMensaje = setTimeout(function() {

        caja.className = "oculto";

    }, 4500);

}


// ========================================
// FORMATOS DE FECHA Y HORA
// ========================================

// "2026-11-12" -> "12/11/2026"
function formatearFecha(fecha) {

    return String(fecha).split("-").reverse().join("/");

}


// "13:00" -> "1:00 PM"
function formatoHora(hora24) {

    const partes = String(hora24).split(":");

    let horas = Number(partes[0]);

    const periodo = horas >= 12 ? "PM" : "AM";

    horas = horas % 12;

    if (horas === 0) {

        horas = 12;

    }

    return horas + ":" + partes[1] + " " + periodo;

}


// Fecha de hoy "AAAA-MM-DD" (hora local)
function fechaDeHoy() {

    return new Date().toLocaleDateString("en-CA");

}