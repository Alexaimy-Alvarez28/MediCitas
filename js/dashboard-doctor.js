// ========================================
// PANEL DEL DOCTOR Y RECEPCIÓN (CONECTADO A LA API)
// ========================================
// Requiere js/api.js cargado antes que este archivo.
// ========================================


let perfil = null;

let seccionActual = "cola";

let datosCola = null;

let porCobrar = { precioConsulta: 0, citas: [] };

let resumenDia = null;

let pendientes = [];

let historial = [];

let pacienteElegido = null;

let citaParaCobrar = null;

let ultimoNoLeidas = 0;

// Contadores para ignorar respuestas viejas (si el usuario
// cambia algo antes de que llegue la respuesta anterior)
let numeroRefresco = 0;

let consultaHorasActual = 0;

let consultaBusqueda = 0;

let temporizadorBusqueda = null;


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

const NOMBRE_METODO = {

    efectivo: "Efectivo",

    tarjeta: "Tarjeta",

    seguro: "Seguro",

    transferencia: "Transferencia"

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
    if (usuario.rol !== "doctor") {

        window.location.href =
            PANEL_POR_ROL[usuario.rol] || "login.html";

        return;

    }


    // Fechas
    document.getElementById("campoFechaCola").value = fechaDeHoy();

    document.getElementById("fechaNueva").min = fechaDeHoy();

    document.getElementById("nuevoNacimiento").max = fechaDeHoy();


    // ---------- Eventos de la cola ----------

    document.getElementById("campoFechaCola")
        .addEventListener("change", function() {

            refrescarTablero(false);

        });

    document.getElementById("btnHoy")
        .addEventListener("click", function() {

            document.getElementById("campoFechaCola").value =
                fechaDeHoy();

            refrescarTablero(false);

        });


    // ---------- Eventos de nueva cita ----------

    document.getElementById("buscarPaciente")
        .addEventListener("input", alEscribirBusqueda);

    document.getElementById("btnMostrarNuevoPaciente")
        .addEventListener("click", function() {

            document.getElementById("formNuevoPaciente")
                .classList.toggle("oculto");

        });

    document.getElementById("btnCancelarNuevoPaciente")
        .addEventListener("click", function() {

            limpiarFormularioNuevoPaciente();

        });

    document.getElementById("btnGuardarPaciente")
        .addEventListener("click", guardarNuevoPaciente);

    document.getElementById("btnCambiarPaciente")
        .addEventListener("click", function() {

            elegirPaciente(null);

        });

    document.getElementById("fechaNueva")
        .addEventListener("change", cargarHorasNueva);

    document.getElementById("btnAgendar")
        .addEventListener("click", agendarCita);


    // ---------- Eventos del historial ----------

    document.getElementById("filtroEstado")
        .addEventListener("change", dibujarHistorial);

    document.getElementById("filtroTexto")
        .addEventListener("input", dibujarHistorial);


    // ---------- Eventos del perfil ----------

    document.getElementById("btnGuardarPerfil")
        .addEventListener("click", guardarPerfilDoctor);


    // ---------- Eventos del cobro ----------

    document.getElementById("btnCobroCancelar")
        .addEventListener("click", cerrarModalCobro);

    document.getElementById("btnCobroConfirmar")
        .addEventListener("click", confirmarCobro);

    // Clic en el fondo oscuro o tecla Escape: cerrar
    document.getElementById("modalCobro")
        .addEventListener("click", function(evento) {

            if (evento.target === this) {

                cerrarModalCobro();

            }

        });

    document.addEventListener("keydown", function(evento) {

        if (evento.key === "Escape") {

            cerrarModalCobro();

        }

    });


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


    // ---------- Primera carga ----------

    await cargarPerfil();

    await refrescarTodo();

    cargarNotificaciones();

    // Cada 15 segundos se actualiza la cola (si se está mirando)
    setInterval(refrescoPeriodico, 15000);

    // Cada 30 segundos se consultan los avisos nuevos
    setInterval(cargarNotificaciones, 30000);

});


function refrescoPeriodico() {

    // Si la pestaña no se está viendo, no se gasta tráfico
    if (document.visibilityState !== "visible") {

        return;

    }

    if (seccionActual === "cola") {

        refrescarTablero(true);

    }

}


// ========================================
// NAVEGACIÓN ENTRE SECCIONES
// ========================================

function mostrarSeccionDoctor(idSeccion) {

    seccionActual = idSeccion;

    document.querySelectorAll(".seccion-dashboard").forEach(
        function(seccion) {

            seccion.classList.add("oculto");

        }
    );

    const mapaSecciones = {

        cola: "seccionCola",

        nueva: "seccionNueva",

        historial: "seccionHistorial",

        perfil: "seccionPerfil"

    };

    const seccion = document.getElementById(mapaSecciones[idSeccion]);

    if (seccion) {

        seccion.classList.remove("oculto");

    }

    const titulos = {

        cola: "Cola de espera",

        nueva: "Nueva cita",

        historial: "Historial de citas",

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

    // Al entrar a estas secciones, se actualizan los datos
    if (idSeccion === "cola" || idSeccion === "historial") {

        refrescarTodo();

    }

    if (idSeccion === "nueva") {

        document.getElementById("buscarPaciente").focus();

    }

}


// ========================================
// DIBUJAR FILAS (una sola función para todas las listas)
// ========================================
// Cada fila es un objeto:
// {
//   turno:     número opcional (círculo azul),
//   titulo:    texto en negrita,
//   lineas:    [textos],
//   etiquetas: [{ texto, clase }],
//   botones:   [{ texto, clase, accion, deshabilitado, titulo }]
// }
// Todo se escribe con textContent (nunca innerHTML).
// ========================================

function dibujarFilas(contenedor, filas, textoVacio) {

    contenedor.replaceChildren();

    if (filas.length === 0) {

        const vacio = document.createElement("p");

        vacio.className = "texto-vacio";

        vacio.textContent = textoVacio;

        contenedor.appendChild(vacio);

        return;

    }

    filas.forEach(function(datos) {

        const fila = document.createElement("div");

        fila.className = "fila-cita";


        // ---------- Parte izquierda ----------

        const izquierda = document.createElement("div");

        izquierda.className = "fila-izquierda";

        if (datos.turno !== undefined && datos.turno !== null) {

            const turno = document.createElement("span");

            turno.className = "turno";

            turno.textContent = datos.turno;

            izquierda.appendChild(turno);

        }

        const info = document.createElement("div");

        const titulo = document.createElement("strong");

        titulo.textContent = datos.titulo;

        info.appendChild(titulo);

        (datos.lineas || []).forEach(function(texto) {

            const linea = document.createElement("p");

            linea.textContent = texto;

            info.appendChild(linea);

        });

        izquierda.appendChild(info);


        // ---------- Parte derecha ----------

        const derecha = document.createElement("div");

        derecha.className = "acciones-cita";

        (datos.etiquetas || []).forEach(function(etiqueta) {

            const marca = document.createElement("span");

            marca.className = etiqueta.clase;

            marca.textContent = etiqueta.texto;

            derecha.appendChild(marca);

        });

        (datos.botones || []).forEach(function(boton) {

            const elemento = document.createElement("button");

            elemento.className = "btn btn-pequeno " + boton.clase;

            elemento.textContent = boton.texto;

            if (boton.deshabilitado) {

                elemento.disabled = true;

            }

            if (boton.titulo) {

                elemento.title = boton.titulo;

            }

            elemento.addEventListener("click", boton.accion);

            derecha.appendChild(elemento);

        });

        fila.appendChild(izquierda);

        fila.appendChild(derecha);

        contenedor.appendChild(fila);

    });

}


function etiquetaEstado(estado) {

    return {

        texto: TEXTO_ESTADO[estado] || estado,

        clase: "etiqueta-estado " + (CLASE_ESTADO[estado] || "")

    };

}


function etiquetaOrigen(origen) {

    if (origen === "app") {

        return { texto: "App", clase: "insignia insignia-app" };

    }

    return { texto: "Recepción", clase: "insignia" };

}


// "15:10" no viene de la API para las horas reales, así que se
// convierte la fecha completa a hora local legible
function horaDeFecha(fechaIso) {

    return new Date(fechaIso).toLocaleTimeString("es", {

        hour: "numeric",

        minute: "2-digit"

    });

}


function textoEspera(minutos) {

    if (minutos === null || minutos === undefined) {

        return "-";

    }

    if (minutos >= 1440) {

        return "más de 1 día";

    }

    if (minutos >= 60) {

        return Math.floor(minutos / 60) + " h " + (minutos % 60) + " min";

    }

    return minutos + " min";

}


// ========================================
// CARGA Y DIBUJO DEL TABLERO
// ========================================

async function refrescarTodo() {

    await Promise.all([
        refrescarTablero(false),
        cargarPendientesYHistorial()
    ]);

}


async function refrescarTablero(silencioso) {

    const fecha =
        document.getElementById("campoFechaCola").value || fechaDeHoy();

    numeroRefresco = numeroRefresco + 1;

    const miNumero = numeroRefresco;

    const parametro = "?fecha=" + encodeURIComponent(fecha);

    try {

        const resultados = await Promise.all([

            llamarApi("/citas/cola" + parametro),

            llamarApi("/citas/por-cobrar" + parametro),

            llamarApi("/reportes/diario" + parametro)

        ]);

        // Llegó una respuesta vieja: se descarta
        if (miNumero !== numeroRefresco) {

            return;

        }

        datosCola = resultados[0];

        porCobrar = resultados[1];

        resumenDia = resultados[2].resumen;

        dibujarTablero();

    } catch (error) {

        if (silencioso) {

            console.error(error);

        } else {

            mostrarMensaje(error.message, "error");

        }

    }

}


function lineasCita(cita) {

    const lineas = ["Cita: " + formatoHora(cita.hora)];

    if (cita.motivo) {

        lineas.push("Motivo: " + cita.motivo);

    }

    return lineas;

}


function dibujarTablero() {

    if (!datosCola) {

        return;

    }

    // ---------- Tarjetas ----------

    if (resumenDia) {

        fijarTexto("statTotal", resumenDia.totalCitas);

        fijarTexto("statCompletadas", resumenDia.completadas);

        fijarTexto("statIngresos", dinero(resumenDia.ingresosTotal));

    }

    fijarTexto("statEspera", datosCola.enEspera.length);


    const hayEnConsulta = datosCola.enConsulta !== null;


    // ---------- En consulta ----------

    const filasConsulta = [];

    if (hayEnConsulta) {

        const cita = datosCola.enConsulta;

        filasConsulta.push({

            titulo: cita.paciente,

            lineas: lineasCita(cita).concat([
                "Inició a las " + horaDeFecha(cita.hora_inicio)
            ]),

            etiquetas: [etiquetaOrigen(cita.origen)],

            botones: [

                {
                    texto: "Completar",
                    clase: "btn-primario",
                    accion: function() {

                        completarConsulta(cita);

                    }
                }

            ]

        });

    }

    dibujarFilas(
        document.getElementById("listaConsulta"),
        filasConsulta,
        "Nadie en consulta ahora"
    );


    // ---------- Sala de espera ----------

    dibujarFilas(

        document.getElementById("listaEspera"),

        datosCola.enEspera.map(function(cita) {

            return {

                turno: cita.turno,

                titulo: cita.paciente,

                lineas: lineasCita(cita).concat([
                    "Esperando: " + textoEspera(cita.minutos_espera)
                ]),

                etiquetas: [etiquetaOrigen(cita.origen)],

                botones: [

                    {
                        texto: "Pasar a consulta",
                        clase: "btn-primario",
                        deshabilitado: hayEnConsulta,
                        titulo: hayEnConsulta
                            ? "Termina primero la consulta actual"
                            : "",
                        accion: function() {

                            cambiarEstado(
                                cita.id,
                                "En consulta",
                                "Consulta iniciada."
                            );

                        }
                    },

                    {
                        texto: "Cancelar",
                        clase: "btn-peligro",
                        accion: function() {

                            cancelarCita(cita);

                        }
                    }

                ]

            };

        }),

        "No hay pacientes en la sala de espera"

    );


    // ---------- Por llegar ----------

    dibujarFilas(

        document.getElementById("listaPorLlegar"),

        datosCola.porLlegar.map(function(cita) {

            return {

                titulo: cita.paciente,

                lineas: lineasCita(cita),

                etiquetas: [etiquetaOrigen(cita.origen)],

                botones: [

                    {
                        texto: "Llegó",
                        clase: "btn-primario",
                        accion: function() {

                            cambiarEstado(
                                cita.id,
                                "En sala",
                                "El paciente pasó a la sala de espera."
                            );

                        }
                    },

                    {
                        texto: "No asistió",
                        clase: "btn-outline",
                        accion: function() {

                            marcarNoAsistio(cita);

                        }
                    },

                    {
                        texto: "Cancelar",
                        clase: "btn-peligro",
                        accion: function() {

                            cancelarCita(cita);

                        }
                    }

                ]

            };

        }),

        "No hay citas confirmadas por llegar"

    );


    // ---------- Por cobrar ----------

    dibujarFilas(

        document.getElementById("listaPorCobrar"),

        porCobrar.citas.map(function(cita) {

            return {

                titulo: cita.paciente,

                lineas: lineasCita(cita),

                etiquetas: [etiquetaEstado(cita.estado)],

                botones: [

                    {
                        texto: "Cobrar",
                        clase: "btn-primario",
                        accion: function() {

                            abrirModalCobro(cita);

                        }
                    }

                ]

            };

        }),

        "No hay cobros pendientes"

    );

}


function fijarTexto(id, texto) {

    document.getElementById(id).textContent = texto;

}


// ========================================
// PENDIENTES DE CONFIRMAR (de todas las fechas) E HISTORIAL
// ========================================

async function cargarPendientesYHistorial() {

    try {

        historial = await llamarApi("/citas");

        // Todas las pendientes, de cualquier fecha
        pendientes = historial.filter(function(cita) {

            return cita.estado === "Pendiente";

        });

        dibujarPendientes();

        dibujarHistorial();

    } catch (error) {

        mostrarMensaje(error.message, "error");

    }

}


function dibujarPendientes() {

    const hoy = fechaDeHoy();

    fijarTexto(
        "tituloPendientes",
        "Pendientes de confirmar (" + pendientes.length + ")"
    );

    dibujarFilas(

        document.getElementById("listaPendientes"),

        pendientes.map(function(cita) {

            const etiquetas = [etiquetaOrigen(cita.origen)];

            if (cita.fecha < hoy) {

                etiquetas.push({
                    texto: "Fecha pasada",
                    clase: "insignia insignia-alerta"
                });

            }

            const lineas = [
                formatearFecha(cita.fecha) + " - " + formatoHora(cita.hora)
            ];

            if (cita.motivo) {

                lineas.push("Motivo: " + cita.motivo);

            }

            return {

                titulo: cita.paciente,

                lineas: lineas,

                etiquetas: etiquetas,

                botones: [

                    {
                        texto: "Confirmar",
                        clase: "btn-primario",
                        accion: function() {

                            cambiarEstado(
                                cita.id,
                                "Confirmada",
                                "Cita confirmada."
                            );

                        }
                    },

                    {
                        texto: "Cancelar",
                        clase: "btn-peligro",
                        accion: function() {

                            cancelarCita(cita);

                        }
                    }

                ]

            };

        }),

        "No hay citas pendientes de confirmar"

    );

}


function dibujarHistorial() {

    const estado = document.getElementById("filtroEstado").value;

    const texto =
        document.getElementById("filtroTexto").value.trim().toLowerCase();

    // Las más recientes primero
    let lista = historial.slice().reverse();

    lista = lista.filter(function(cita) {

        if (estado !== "" && cita.estado !== estado) {

            return false;

        }

        if (
            texto !== "" &&
            !cita.paciente.toLowerCase().includes(texto)
        ) {

            return false;

        }

        return true;

    });

    const total = lista.length;

    // Para no cargar la pantalla con miles de filas
    lista = lista.slice(0, 100);

    dibujarFilas(

        document.getElementById("listaHistorial"),

        lista.map(function(cita) {

            const lineas = [
                formatearFecha(cita.fecha) + " - " + formatoHora(cita.hora)
            ];

            if (cita.motivo) {

                lineas.push("Motivo: " + cita.motivo);

            }

            return {

                titulo: cita.paciente,

                lineas: lineas,

                etiquetas: [
                    etiquetaOrigen(cita.origen),
                    etiquetaEstado(cita.estado)
                ],

                botones: []

            };

        }),

        "No hay citas con ese filtro"

    );

    fijarTexto(
        "notaHistorial",
        total > 100
            ? "Mostrando las 100 más recientes de " + total + " citas."
            : ""
    );

}


// ========================================
// ACCIONES SOBRE LAS CITAS
// ========================================

// Cambia el estado de una cita y vuelve a pedir los datos.
// Devuelve true si salió bien.
async function cambiarEstado(idCita, nuevoEstado, mensajeExito) {

    try {

        await llamarApi("/citas/" + idCita + "/estado", {

            metodo: "PATCH",

            cuerpo: { estado: nuevoEstado }

        });

        mostrarMensaje(mensajeExito, "exito");

        await refrescarTodo();

        return true;

    } catch (error) {

        mostrarMensaje(error.message, "error");

        // Si otra persona la modificó, se actualiza la pantalla
        await refrescarTodo();

        return false;

    }

}


function cancelarCita(cita) {

    const confirmacion = confirm(
        "¿Cancelar la cita de " + cita.paciente + "?"
    );

    if (!confirmacion) {

        return;

    }

    cambiarEstado(cita.id, "Cancelada", "La cita fue cancelada.");

}


function marcarNoAsistio(cita) {

    const confirmacion = confirm(
        "¿Marcar que " + cita.paciente + " no asistió a su cita?"
    );

    if (!confirmacion) {

        return;

    }

    cambiarEstado(
        cita.id,
        "No asistio",
        "Se registró que el paciente no asistió."
    );

}


async function completarConsulta(cita) {

    const exito = await cambiarEstado(
        cita.id,
        "Completada",
        "Consulta completada."
    );

    // Si quedó pendiente de cobro, se ofrece cobrar de inmediato
    if (exito) {

        const sinCobrar = porCobrar.citas.some(function(item) {

            return item.id === cita.id;

        });

        if (sinCobrar) {

            abrirModalCobro({
                id: cita.id,
                paciente: cita.paciente,
                hora: cita.hora
            });

        }

    }

}


// ========================================
// COBRO (VENTANA EMERGENTE)
// ========================================

function abrirModalCobro(cita) {

    citaParaCobrar = cita;

    fijarTexto(
        "modalCobroPaciente",
        cita.paciente + " · cita de " + formatoHora(cita.hora)
    );

    document.getElementById("cobroMetodo").value = "efectivo";

    // Se sugiere el precio de consulta del doctor
    document.getElementById("cobroMonto").value =
        Number(porCobrar.precioConsulta) || 0;

    document.getElementById("modalCobro").classList.remove("oculto");

    document.getElementById("cobroMonto").focus();

}


function cerrarModalCobro() {

    citaParaCobrar = null;

    document.getElementById("modalCobro").classList.add("oculto");

}


async function confirmarCobro() {

    if (!citaParaCobrar) {

        return;

    }

    const metodoPago = document.getElementById("cobroMetodo").value;

    const textoMonto = document.getElementById("cobroMonto").value;

    const monto = Number(textoMonto);

    if (textoMonto === "" || !Number.isFinite(monto) || monto < 0) {

        mostrarMensaje("Escribe un monto válido.", "error");

        return;

    }

    const idCita = citaParaCobrar.id;

    const boton = document.getElementById("btnCobroConfirmar");

    boton.disabled = true;

    try {

        await llamarApi("/citas/" + idCita + "/pago", {

            metodo: "PATCH",

            cuerpo: { metodoPago: metodoPago, monto: monto }

        });

        mostrarMensaje(
            "Cobro registrado: " + dinero(monto) +
            " (" + NOMBRE_METODO[metodoPago] + ").",
            "exito"
        );

        cerrarModalCobro();

        await refrescarTablero(false);

    } catch (error) {

        mostrarMensaje(error.message, "error");

        // 409: ya estaba cobrada. Se cierra y se actualiza
        if (error.estado === 409) {

            cerrarModalCobro();

            await refrescarTablero(false);

        }

    } finally {

        boton.disabled = false;

    }

}


// ========================================
// NUEVA CITA: BUSCAR O REGISTRAR PACIENTE
// ========================================

function alEscribirBusqueda() {

    clearTimeout(temporizadorBusqueda);

    const texto =
        document.getElementById("buscarPaciente").value.trim();

    if (texto.length < 2) {

        document.getElementById("resultadosPaciente")
            .replaceChildren();

        return;

    }

    // Debounce: se espera una pausa de 300 ms al escribir
    temporizadorBusqueda = setTimeout(function() {

        buscarPacientes(texto);

    }, 300);

}


async function buscarPacientes(texto) {

    consultaBusqueda = consultaBusqueda + 1;

    const miConsulta = consultaBusqueda;

    try {

        const lista = await llamarApi(
            "/pacientes?buscar=" + encodeURIComponent(texto)
        );

        if (miConsulta !== consultaBusqueda) {

            return;

        }

        dibujarFilas(

            document.getElementById("resultadosPaciente"),

            lista.map(function(paciente) {

                const lineas = [];

                if (paciente.telefono) {

                    lineas.push("Tel: " + paciente.telefono);

                }

                if (paciente.documento) {

                    lineas.push("Documento: " + paciente.documento);

                }

                return {

                    titulo: paciente.nombre,

                    lineas: lineas,

                    botones: [

                        {
                            texto: "Seleccionar",
                            clase: "btn-primario",
                            accion: function() {

                                elegirPaciente(paciente);

                            }
                        }

                    ]

                };

            }),

            "No se encontraron pacientes. Puedes registrar uno nuevo."

        );

    } catch (error) {

        mostrarMensaje(error.message, "error");

    }

}


function elegirPaciente(paciente) {

    pacienteElegido = paciente;

    const bloqueBusqueda = document.getElementById("bloqueBusqueda");

    const chip = document.getElementById("pacienteElegido");

    if (paciente) {

        fijarTexto(
            "textoPacienteElegido",
            "Paciente: " + paciente.nombre +
                (paciente.telefono ? " · " + paciente.telefono : "")
        );

        bloqueBusqueda.classList.add("oculto");

        chip.classList.remove("oculto");

    } else {

        bloqueBusqueda.classList.remove("oculto");

        chip.classList.add("oculto");

        document.getElementById("buscarPaciente").focus();

    }

}


function limpiarFormularioNuevoPaciente() {

    document.getElementById("nuevoNombre").value = "";

    document.getElementById("nuevoTelefono").value = "";

    document.getElementById("nuevoDocumento").value = "";

    document.getElementById("nuevoNacimiento").value = "";

    document.getElementById("formNuevoPaciente").classList.add("oculto");

}


async function guardarNuevoPaciente() {

    const nombre = document.getElementById("nuevoNombre").value.trim();

    if (nombre === "") {

        mostrarMensaje("El nombre del paciente es obligatorio.", "error");

        return;

    }

    const boton = document.getElementById("btnGuardarPaciente");

    boton.disabled = true;

    try {

        const creado = await llamarApi("/pacientes", {

            metodo: "POST",

            cuerpo: {

                nombre: nombre,

                telefono:
                    document.getElementById("nuevoTelefono").value.trim(),

                documento:
                    document.getElementById("nuevoDocumento").value.trim(),

                fechaNacimiento:
                    document.getElementById("nuevoNacimiento").value

            }

        });

        mostrarMensaje("Paciente registrado.", "exito");

        limpiarFormularioNuevoPaciente();

        document.getElementById("resultadosPaciente").replaceChildren();

        document.getElementById("buscarPaciente").value = "";

        elegirPaciente(creado);

    } catch (error) {

        mostrarMensaje(error.message, "error");

    } finally {

        boton.disabled = false;

    }

}


// ========================================
// NUEVA CITA: HORAS LIBRES Y AGENDAR
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


function reiniciarHorasNueva(textoGuia) {

    consultaHorasActual = consultaHorasActual + 1;

    const select = document.getElementById("horaNueva");

    select.replaceChildren(
        crearOpcion("", textoGuia || "Selecciona una fecha")
    );

    select.disabled = true;

    document.getElementById("avisoHorasNueva").classList.add("oculto");

}


async function cargarHorasNueva() {

    const fecha = document.getElementById("fechaNueva").value;

    const select = document.getElementById("horaNueva");

    const aviso = document.getElementById("avisoHorasNueva");

    if (fecha === "" || !perfil) {

        reiniciarHorasNueva();

        return;

    }

    if (fecha < fechaDeHoy()) {

        reiniciarHorasNueva();

        aviso.textContent = "Elige una fecha de hoy en adelante.";

        aviso.classList.remove("oculto");

        return;

    }


    consultaHorasActual = consultaHorasActual + 1;

    const miConsulta = consultaHorasActual;

    select.disabled = true;

    try {

        const datos = await llamarApi(
            "/doctores/" + perfil.id +
            "/disponibilidad?fecha=" + encodeURIComponent(fecha)
        );

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

        reiniciarHorasNueva();

        mostrarMensaje(error.message, "error");

    }

}


function reiniciarNuevaCita() {

    elegirPaciente(null);

    document.getElementById("buscarPaciente").value = "";

    document.getElementById("resultadosPaciente").replaceChildren();

    document.getElementById("fechaNueva").value = "";

    document.getElementById("motivoNueva").value = "";

    document.getElementById("autoConfirmar").checked = true;

    reiniciarHorasNueva();

}


async function agendarCita() {

    if (!pacienteElegido) {

        mostrarMensaje(
            "Primero elige o registra un paciente.",
            "error"
        );

        return;

    }

    const fecha = document.getElementById("fechaNueva").value;

    const hora = document.getElementById("horaNueva").value;

    const motivo = document.getElementById("motivoNueva").value.trim();

    if (fecha === "" || hora === "") {

        mostrarMensaje("Elige la fecha y la hora.", "error");

        return;

    }

    const boton = document.getElementById("btnAgendar");

    boton.disabled = true;

    try {

        const cita = await llamarApi("/citas", {

            metodo: "POST",

            cuerpo: {

                pacienteId: pacienteElegido.id,

                fecha: fecha,

                hora: hora,

                motivo: motivo

            }

        });

        let mensaje =
            "Cita agendada para " + pacienteElegido.nombre +
            " el " + formatearFecha(fecha) +
            " a las " + formatoHora(hora) + ".";

        // La recepción la creó, así que puede quedar confirmada
        if (document.getElementById("autoConfirmar").checked) {

            try {

                await llamarApi("/citas/" + cita.id + "/estado", {

                    metodo: "PATCH",

                    cuerpo: { estado: "Confirmada" }

                });

                mensaje = mensaje + " Quedó confirmada.";

            } catch (errorConfirmar) {

                mensaje = mensaje + " Quedó pendiente de confirmar.";

            }

        } else {

            mensaje = mensaje + " Queda pendiente de confirmar.";

        }

        mostrarMensaje(mensaje, "exito");

        // Se muestra la cola de la fecha de la cita nueva
        document.getElementById("campoFechaCola").value = fecha;

        reiniciarNuevaCita();

        mostrarSeccionDoctor("cola");

    } catch (error) {

        mostrarMensaje(error.message, "error");

        // 409: alguien ocupó esa hora justo antes
        if (error.estado === 409) {

            cargarHorasNueva();

        }

    } finally {

        boton.disabled = false;

    }

}


// ========================================
// PERFIL
// ========================================

async function cargarPerfil() {

    try {

        perfil = await llamarApi("/doctores/yo");

        llenarPerfil();

    } catch (error) {

        mostrarMensaje(error.message, "error");

    }

}


function llenarPerfil() {

    fijarTexto(
        "subtituloPanel",
        "Dr(a). " + perfil.nombre + " · " + perfil.especialidad
    );

    fijarTexto(
        "perfilAvatar",
        perfil.nombre.charAt(0).toUpperCase()
    );

    fijarTexto("perfilNombreCorto", "Dr(a). " + perfil.nombre);

    fijarTexto("perfilEspecialidadCorta", perfil.especialidad);

    document.getElementById("perfilNombre").value = perfil.nombre || "";

    document.getElementById("perfilEspecialidad").value =
        perfil.especialidad || "Medicina general";

    document.getElementById("perfilCorreo").value = perfil.correo || "";

    document.getElementById("perfilTelefono").value =
        perfil.telefono || "";

    document.getElementById("perfilPrecio").value =
        dinero(Number(perfil.precioConsulta) || 0);

}


async function guardarPerfilDoctor() {

    const nombre = document.getElementById("perfilNombre").value.trim();

    if (nombre === "") {

        mostrarMensaje("El nombre es obligatorio.", "error");

        return;

    }

    const boton = document.getElementById("btnGuardarPerfil");

    boton.disabled = true;

    try {

        perfil = await llamarApi("/doctores/yo", {

            metodo: "PUT",

            cuerpo: {

                nombre: nombre,

                especialidad:
                    document.getElementById("perfilEspecialidad").value,

                telefono:
                    document.getElementById("perfilTelefono").value.trim()

            }

        });

        llenarPerfil();

        mostrarMensaje("Perfil actualizado correctamente.", "exito");

    } catch (error) {

        mostrarMensaje(error.message, "error");

    } finally {

        boton.disabled = false;

    }

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


// Consulta periódica: actualiza la burbuja roja y, si llegaron
// avisos nuevos, también la cola y las pendientes
async function cargarNotificaciones() {

    try {

        const datos = await llamarApi("/notificaciones");

        actualizarContador(datos.noLeidas);

        if (datos.noLeidas > ultimoNoLeidas) {

            refrescarTodo();

        }

        ultimoNoLeidas = datos.noLeidas;

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

        ultimoNoLeidas = 0;

    } catch (error) {

        mostrarMensaje(error.message, "error");

    }

}