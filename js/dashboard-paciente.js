// ========================================
// PANEL DEL PACIENTE - LÓGICA (CONECTADO A LA API)
// ========================================
// Requiere js/api.js cargado antes que este archivo.
// ========================================


let perfil = null;

let doctores = [];

let citas = [];

let idProximaCita = null;

// Cada consulta de horas lleva un número. Si llega una respuesta
// con un número viejo, se ignora (evita pintar horas equivocadas
// cuando el usuario cambia la fecha rápido).
let consultaHorasActual = 0;


const ESTADOS_ACTIVOS = ["Pendiente", "Confirmada", "En sala", "En consulta"];

const ESTADOS_CANCELABLES = ["Pendiente", "Confirmada"];

const CLASE_ESTADO = {

    "Pendiente": "etiqueta-pendiente",

    "Confirmada": "etiqueta-confirmada",

    "En sala": "etiqueta-en-sala",

    "En consulta": "etiqueta-en-consulta",

    "Completada": "etiqueta-completada",

    "Cancelada": "etiqueta-cancelada",

    "No asistio": "etiqueta-no-asistio"

};

const TEXTO_ESTADO = {

    "No asistio": "No asistió"

};


// ========================================
// AL ABRIR LA PÁGINA
// ========================================

document.addEventListener("DOMContentLoaded", async function() {

    const usuario = obtenerUsuarioGuardado();

    // Sin sesión: al login
    if (!obtenerToken() || !usuario) {

        window.location.href = "login.html";

        return;

    }

    // Esto es comodidad, no seguridad: la API rechaza lo que
    // no corresponda a cada rol
    if (usuario.rol !== "paciente") {

        window.location.href =
            PANEL_POR_ROL[usuario.rol] || "login.html";

        return;

    }


    // Fecha mínima para agendar: hoy
    document.getElementById("fechaCita").min = fechaDeHoy();

    // Fecha máxima de nacimiento: hoy
    document.getElementById("perfilFechaNacimiento").max = fechaDeHoy();


    // Eventos del formulario de agendar
    document.getElementById("especialidadCita")
        .addEventListener("change", poblarDoctores);

    document.getElementById("doctorCita")
        .addEventListener("change", cargarHoras);

    document.getElementById("fechaCita")
        .addEventListener("change", cargarHoras);


    // Cerrar el panel de notificaciones al hacer clic afuera
    document.addEventListener("click", function(evento) {

        const contenedor =
            document.querySelector(".campana-contenedor");

        if (!contenedor.contains(evento.target)) {

            document
                .getElementById("panelNotificaciones")
                .classList.add("oculto");

        }

    });


    // Las tres cargas son independientes: se hacen a la vez
    await Promise.all([
        cargarPerfil(),
        cargarDoctores(),
        cargarCitas()
    ]);

    cargarNotificaciones();

    // Cada 30 segundos se consulta si hay avisos nuevos
    setInterval(cargarNotificaciones, 30000);

});


// ========================================
// NAVEGACIÓN ENTRE SECCIONES
// ========================================

function primerNombre() {

    return perfil ? perfil.nombre.split(" ")[0] : "";

}


function mostrarSeccionPaciente(idSeccion) {

    document.querySelectorAll(".seccion-dashboard").forEach(
        function(seccion) {

            seccion.classList.add("oculto");

        }
    );

    const mapaSecciones = {

        inicio: "seccionInicio",

        citas: "seccionCitas",

        agendar: "seccionAgendar",

        perfil: "seccionPerfil"

    };

    const seccion = document.getElementById(mapaSecciones[idSeccion]);

    if (seccion) {

        seccion.classList.remove("oculto");

    }

    const titulos = {

        inicio: primerNombre() ? "Bienvenido, " + primerNombre() : "Bienvenido",

        citas: "Mis citas",

        agendar: "Agendar cita",

        perfil: "Perfil"

    };

    document.getElementById("tituloBienvenida").textContent =
        titulos[idSeccion];

    document.querySelectorAll(".nav-item").forEach(function(boton) {

        boton.classList.remove("activo");

        if (boton.dataset.seccion === idSeccion) {

            boton.classList.add("activo");

        }

    });

}


// ========================================
// PERFIL
// ========================================

async function cargarPerfil() {

    try {

        perfil = await llamarApi("/pacientes/yo");

        llenarFormularioPerfil();

        document.getElementById("tituloBienvenida").textContent =
            "Bienvenido, " + primerNombre();

    } catch (error) {

        mostrarMensaje(error.message, "error");

    }

}


function llenarFormularioPerfil() {

    const emergencia = perfil.contactoEmergencia || {};

    document.getElementById("perfilNombre").value =
        perfil.nombre || "";

    document.getElementById("perfilCorreo").value =
        perfil.correo || "";

    document.getElementById("perfilTelefono").value =
        perfil.telefono || "";

    document.getElementById("perfilDocumento").value =
        perfil.documento || "";

    document.getElementById("perfilFechaNacimiento").value =
        perfil.fechaNacimiento || "";

    document.getElementById("perfilDireccion").value =
        perfil.direccion || "";

    document.getElementById("perfilAlergias").value =
        perfil.alergias || "";

    document.getElementById("perfilTipoSangre").value =
        perfil.tipoSangre || "";

    document.getElementById("perfilEmergenciaNombre").value =
        emergencia.nombre || "";

    document.getElementById("perfilEmergenciaParentesco").value =
        emergencia.parentesco || "";

    document.getElementById("perfilEmergenciaTelefono").value =
        emergencia.telefono || "";

}


async function guardarPerfilPaciente() {

    const nombre =
        document.getElementById("perfilNombre").value.trim();

    if (nombre === "") {

        mostrarMensaje("El nombre es obligatorio.", "error");

        return;

    }

    const boton = document.getElementById("btnGuardarPerfil");

    boton.disabled = true;

    try {

        perfil = await llamarApi("/pacientes/yo", {

            metodo: "PUT",

            cuerpo: {

                nombre: nombre,

                telefono:
                    document.getElementById("perfilTelefono").value.trim(),

                direccion:
                    document.getElementById("perfilDireccion").value.trim(),

                alergias:
                    document.getElementById("perfilAlergias").value.trim(),

                tipoSangre:
                    document.getElementById("perfilTipoSangre").value,

                fechaNacimiento:
                    document.getElementById("perfilFechaNacimiento").value,

                contactoEmergencia: {

                    nombre:
                        document
                            .getElementById("perfilEmergenciaNombre")
                            .value.trim(),

                    parentesco:
                        document
                            .getElementById("perfilEmergenciaParentesco")
                            .value,

                    telefono:
                        document
                            .getElementById("perfilEmergenciaTelefono")
                            .value.trim()

                }

            }

        });

        llenarFormularioPerfil();

        mostrarMensaje("Perfil actualizado correctamente.", "exito");

    } catch (error) {

        mostrarMensaje(error.message, "error");

    } finally {

        boton.disabled = false;

    }

}


// ========================================
// AGENDAR UNA CITA
// ========================================

function crearOpcion(valor, texto, deshabilitada) {

    const opcion = document.createElement("option");

    opcion.value = valor;

    opcion.textContent = texto;

    if (deshabilitada) {

        opcion.disabled = true;

    }

    return opcion;

}


async function cargarDoctores() {

    try {

        doctores = await llamarApi("/doctores");

        poblarAreas();

    } catch (error) {

        mostrarMensaje(error.message, "error");

    }

}


// Solo se ofrecen las áreas que tienen al menos un doctor
function poblarAreas() {

    const select = document.getElementById("especialidadCita");

    select.replaceChildren(crearOpcion("", "Selecciona un área"));

    const areas = [];

    doctores.forEach(function(doctor) {

        if (!areas.includes(doctor.especialidad)) {

            areas.push(doctor.especialidad);

        }

    });

    areas.sort();

    areas.forEach(function(area) {

        select.appendChild(crearOpcion(area, area));

    });

    document.getElementById("avisoArea").classList.toggle(
        "oculto",
        areas.length > 0
    );

    poblarDoctores();

}


function poblarDoctores() {

    const area = document.getElementById("especialidadCita").value;

    const select = document.getElementById("doctorCita");

    const aviso = document.getElementById("avisoDoctor");

    select.replaceChildren(crearOpcion("", "Selecciona un doctor"));

    if (area === "") {

        select.disabled = true;

        aviso.classList.remove("oculto");

        reiniciarHoras();

        return;

    }

    doctores
        .filter(function(doctor) {

            return doctor.especialidad === area;

        })
        .forEach(function(doctor) {

            select.appendChild(
                crearOpcion(String(doctor.id), "Dr(a). " + doctor.nombre)
            );

        });

    select.disabled = false;

    aviso.classList.add("oculto");

    reiniciarHoras();

}


function reiniciarHoras() {

    // Cualquier consulta de horas en curso queda descartada
    consultaHorasActual = consultaHorasActual + 1;

    const select = document.getElementById("horaCita");

    select.replaceChildren(crearOpcion("", "Selecciona doctor y fecha"));

    select.disabled = true;

    document.getElementById("avisoHoras").classList.add("oculto");

}


async function cargarHoras() {

    const doctorId = document.getElementById("doctorCita").value;

    const fecha = document.getElementById("fechaCita").value;

    const select = document.getElementById("horaCita");

    const aviso = document.getElementById("avisoHoras");

    if (doctorId === "" || fecha === "") {

        reiniciarHoras();

        return;

    }

    if (fecha < fechaDeHoy()) {

        reiniciarHoras();

        aviso.textContent = "Elige una fecha de hoy en adelante.";

        aviso.classList.remove("oculto");

        return;

    }


    consultaHorasActual = consultaHorasActual + 1;

    const miConsulta = consultaHorasActual;

    select.disabled = true;

    try {

        const datos = await llamarApi(
            "/doctores/" + doctorId +
            "/disponibilidad?fecha=" + encodeURIComponent(fecha)
        );

        // Llegó una respuesta vieja: se descarta
        if (miConsulta !== consultaHorasActual) {

            return;

        }

        select.replaceChildren(crearOpcion("", "Selecciona una hora"));

        let hayLibres = false;

        datos.horas.forEach(function(franja) {

            if (franja.disponible) {

                hayLibres = true;

            }

            select.appendChild(
                crearOpcion(
                    franja.hora,
                    formatoHora(franja.hora) +
                        (franja.disponible ? "" : " (ocupada)"),
                    !franja.disponible
                )
            );

        });

        select.disabled = false;

        aviso.textContent =
            "No hay horas libres ese día. Prueba con otra fecha.";

        aviso.classList.toggle("oculto", hayLibres);

    } catch (error) {

        if (miConsulta !== consultaHorasActual) {

            return;

        }

        reiniciarHoras();

        mostrarMensaje(error.message, "error");

    }

}


async function confirmarCita() {

    const doctorId = document.getElementById("doctorCita").value;

    const fecha = document.getElementById("fechaCita").value;

    const hora = document.getElementById("horaCita").value;

    const motivo = document.getElementById("motivoCita").value.trim();

    if (doctorId === "" || fecha === "" || hora === "") {

        mostrarMensaje(
            "Por favor, completa área, doctor, fecha y hora.",
            "error"
        );

        return;

    }

    const boton = document.getElementById("btnConfirmarCita");

    // Evita enviar dos veces con un doble clic
    boton.disabled = true;

    try {

        await llamarApi("/citas", {

            metodo: "POST",

            cuerpo: {

                doctorId: Number(doctorId),

                fecha: fecha,

                hora: hora,

                motivo: motivo

            }

        });

        mostrarMensaje(
            "Cita agendada correctamente. El doctor la confirmará pronto.",
            "exito"
        );

        // Limpiar el formulario
        document.getElementById("especialidadCita").value = "";

        poblarDoctores();

        document.getElementById("fechaCita").value = "";

        document.getElementById("motivoCita").value = "";

        await cargarCitas();

        mostrarSeccionPaciente("citas");

    } catch (error) {

        mostrarMensaje(error.message, "error");

        // 409: alguien ocupó esa hora justo antes. Se refrescan las horas
        if (error.estado === 409) {

            cargarHoras();

        }

    } finally {

        boton.disabled = false;

    }

}


// ========================================
// CITAS
// ========================================

async function cargarCitas() {

    try {

        citas = await llamarApi("/citas");

        dibujarCitas();

    } catch (error) {

        mostrarMensaje(error.message, "error");

    }

}


function dibujarCitas() {

    const hoy = fechaDeHoy();

    // La próxima cita: activa y de hoy en adelante
    // (la API entrega las citas ordenadas por fecha y hora)
    const activas = citas.filter(function(cita) {

        return (
            ESTADOS_ACTIVOS.includes(cita.estado) &&
            cita.fecha >= hoy
        );

    });

    const proxima = activas[0] || null;

    const bannerTitulo = document.getElementById("bannerTitulo");

    const bannerTexto = document.getElementById("bannerTexto");

    const btnCancelar = document.getElementById("btnCancelarProxima");

    if (!proxima) {

        idProximaCita = null;

        bannerTitulo.textContent = "No tienes citas agendadas";

        bannerTexto.textContent =
            "Agenda tu primera cita médica usando el botón de abajo";

        btnCancelar.classList.add("oculto");

    } else {

        idProximaCita = proxima.id;

        bannerTitulo.textContent =
            "Tienes " + activas.length + " cita(s) agendada(s)";

        bannerTexto.textContent =
            "Próxima cita: " + proxima.especialidad +
            " con el Dr(a). " + proxima.doctor +
            " el " + formatearFecha(proxima.fecha) +
            " a las " + formatoHora(proxima.hora);

        btnCancelar.classList.toggle(
            "oculto",
            !ESTADOS_CANCELABLES.includes(proxima.estado)
        );

    }

    // Las más recientes primero
    const recientesPrimero = citas.slice().reverse();

    dibujarListaCitas(
        document.getElementById("historialCitas"),
        recientesPrimero.slice(0, 5),
        false
    );

    dibujarListaCitas(
        document.getElementById("listaMisCitas"),
        recientesPrimero,
        true
    );

}


// Dibuja una lista de citas con textContent (nunca innerHTML)
function dibujarListaCitas(contenedor, lista, conBotonCancelar) {

    contenedor.replaceChildren();

    if (lista.length === 0) {

        const vacio = document.createElement("p");

        vacio.className = "texto-vacio";

        vacio.textContent = "No tienes citas registradas aún";

        contenedor.appendChild(vacio);

        return;

    }

    lista.forEach(function(cita) {

        const fila = document.createElement("div");

        fila.className = "fila-cita";


        // ---------- Información ----------

        const info = document.createElement("div");

        const titulo = document.createElement("strong");

        titulo.textContent = cita.especialidad;

        const lineaDoctor = document.createElement("p");

        lineaDoctor.textContent = "Dr(a). " + cita.doctor;

        const lineaFecha = document.createElement("p");

        lineaFecha.textContent =
            formatearFecha(cita.fecha) + " - " + formatoHora(cita.hora);

        info.appendChild(titulo);

        info.appendChild(lineaDoctor);

        info.appendChild(lineaFecha);

        if (cita.motivo) {

            const lineaMotivo = document.createElement("p");

            lineaMotivo.textContent = "Motivo: " + cita.motivo;

            info.appendChild(lineaMotivo);

        }


        // ---------- Estado y botón ----------

        const derecha = document.createElement("div");

        derecha.className = "acciones-cita";

        const etiqueta = document.createElement("span");

        etiqueta.className =
            "etiqueta-estado " + (CLASE_ESTADO[cita.estado] || "");

        etiqueta.textContent = TEXTO_ESTADO[cita.estado] || cita.estado;

        derecha.appendChild(etiqueta);

        if (
            conBotonCancelar &&
            ESTADOS_CANCELABLES.includes(cita.estado)
        ) {

            const boton = document.createElement("button");

            boton.className = "btn btn-peligro btn-pequeno";

            boton.textContent = "Cancelar";

            boton.addEventListener("click", function() {

                cancelarCitaPorId(cita.id);

            });

            derecha.appendChild(boton);

        }

        fila.appendChild(info);

        fila.appendChild(derecha);

        contenedor.appendChild(fila);

    });

}


async function cancelarCitaPorId(idCita) {

    const cita = citas.find(function(item) {

        return item.id === idCita;

    });

    if (!cita) {

        return;

    }

    const confirmacion = confirm(
        "¿Deseas cancelar tu cita de " + cita.especialidad +
        " el " + formatearFecha(cita.fecha) +
        " a las " + formatoHora(cita.hora) + "?"
    );

    if (!confirmacion) {

        return;

    }

    try {

        await llamarApi("/citas/" + idCita + "/cancelar", {
            metodo: "PATCH"
        });

        mostrarMensaje("La cita fue cancelada.", "exito");

        await cargarCitas();

    } catch (error) {

        mostrarMensaje(error.message, "error");

        // Si alguien más la modificó, se actualiza la lista
        await cargarCitas();

    }

}


function cancelarProximaCita() {

    if (idProximaCita === null) {

        mostrarMensaje("No tienes citas para cancelar.", "info");

        return;

    }

    cancelarCitaPorId(idProximaCita);

}


// ========================================
// NOTIFICACIONES (LA CAMPANA)
// ========================================

function actualizarContador(cantidad) {

    const contador = document.getElementById("contadorNotificaciones");

    if (cantidad === 0) {

        contador.classList.add("oculto");

    } else {

        contador.textContent = cantidad;

        contador.classList.remove("oculto");

    }

}


// Consulta periódica: solo actualiza la burbuja roja
async function cargarNotificaciones() {

    try {

        const datos = await llamarApi("/notificaciones");

        actualizarContador(datos.noLeidas);

    } catch (error) {

        // Un fallo de la campana no debe molestar al usuario
        console.error(error);

    }

}


function dibujarNotificaciones(lista) {

    const contenedor = document.getElementById("listaNotificaciones");

    contenedor.replaceChildren();

    if (lista.length === 0) {

        const vacio = document.createElement("p");

        vacio.className = "texto-vacio";

        vacio.textContent = "No tienes notificaciones";

        contenedor.appendChild(vacio);

        return;

    }

    lista.forEach(function(notificacion) {

        const item = document.createElement("div");

        item.className = "notificacion-item" +
            (notificacion.leida ? "" : " notificacion-nueva");

        item.textContent = notificacion.mensaje;

        contenedor.appendChild(item);

    });

}


async function alternarPanelNotificaciones() {

    const panel = document.getElementById("panelNotificaciones");

    panel.classList.toggle("oculto");

    // Si se acaba de cerrar, no hay nada más que hacer
    if (panel.classList.contains("oculto")) {

        return;

    }

    try {

        const datos = await llamarApi("/notificaciones");

        // Se dibujan primero (con las nuevas resaltadas)...
        dibujarNotificaciones(datos.notificaciones);

        // ...y después se marcan como leídas
        if (datos.noLeidas > 0) {

            await llamarApi("/notificaciones/leer", { metodo: "PATCH" });

        }

        actualizarContador(0);

    } catch (error) {

        mostrarMensaje(error.message, "error");

    }

}