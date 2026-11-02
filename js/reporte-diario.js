// ========================================
// REPORTE DIARIO - LÓGICA
// ========================================


// Dirección de la API (el backend)
const API = "http://localhost:3000/api";

// Símbolo de moneda que se muestra (cámbialo según la clínica)
const SIMBOLO_MONEDA = "$";

const formatoNumero = new Intl.NumberFormat("en-US", {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2

});

// Aquí guardamos las gráficas creadas para poder destruirlas
// antes de dibujarlas de nuevo (si no, Chart.js da error)
const graficas = {};


// ========================================
// FUNCIONES PEQUEÑAS DE AYUDA
// ========================================

function dinero(valor) {

    return SIMBOLO_MONEDA + formatoNumero.format(valor);

}


function capitalizar(texto) {

    return texto.charAt(0).toUpperCase() + texto.slice(1);

}


// textContent trata TODO como texto plano: así un nombre
// malicioso nunca se ejecuta como código (evita XSS)
function fijarTexto(id, texto) {

    document.getElementById(id).textContent = texto;

}


function fechaLarga(fecha) {

    // Se agrega T12:00:00 para que la zona horaria no mueva el día
    const texto =
        new Date(fecha + "T12:00:00").toLocaleDateString("es", {

            weekday: "long",

            day: "numeric",

            month: "long",

            year: "numeric"

        });

    return capitalizar(texto);

}


function fechaDeHoy() {

    return new Date().toLocaleDateString("en-CA");

}


// ========================================
// SESIÓN (token guardado en sessionStorage)
// ========================================
// sessionStorage se borra al cerrar la pestaña.
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


function guardarSesionReporte(token, usuario) {

    sessionStorage.setItem("medicitas_token", token);

    sessionStorage.setItem("medicitas_usuario", JSON.stringify(usuario));

}


function cerrarSesionReporte(mensaje) {

    sessionStorage.removeItem("medicitas_token");

    sessionStorage.removeItem("medicitas_usuario");

    mostrarLogin(mensaje || "");

}


// ========================================
// CAMBIO ENTRE VISTAS
// ========================================

function mostrarLogin(mensaje) {

    document.getElementById("vistaReporte").classList.add("oculto");

    document.getElementById("vistaLogin").classList.remove("oculto");

    fijarTexto("avisoLogin", mensaje || "");

}


function mostrarReporte() {

    document.getElementById("vistaLogin").classList.add("oculto");

    document.getElementById("vistaReporte").classList.remove("oculto");

    const usuario = obtenerUsuarioGuardado();

    fijarTexto("textoUsuario", usuario ? usuario.correo : "");

    // La vista ya es visible: ahora sí se pueden dibujar las gráficas
    cargarReporte();

}


// ========================================
// LOGIN
// ========================================

document.getElementById("formLogin").addEventListener(

    "submit",

    async function(evento) {

        evento.preventDefault();

        const correo =
            document.getElementById("correoLogin").value.trim();

        const contrasena =
            document.getElementById("contrasenaLogin").value;

        fijarTexto("avisoLogin", "");

        if (correo === "" || contrasena === "") {

            fijarTexto("avisoLogin", "Completa correo y contraseña.");

            return;

        }


        try {

            const respuesta = await fetch(API + "/auth/login", {

                method: "POST",

                headers: { "Content-Type": "application/json" },

                body: JSON.stringify({
                    correo: correo,
                    contrasena: contrasena
                })

            });

            const datos = await respuesta.json();

            // respuesta.ok es true si el estado fue 200 a 299
            if (!respuesta.ok) {

                fijarTexto(
                    "avisoLogin",
                    datos.mensaje || "No se pudo iniciar sesión."
                );

                return;

            }

            // Solo el personal puede ver reportes
            if (
                datos.usuario.rol !== "doctor" &&
                datos.usuario.rol !== "admin"
            ) {

                fijarTexto(
                    "avisoLogin",
                    "Esta cuenta no tiene acceso a los reportes."
                );

                return;

            }

            guardarSesionReporte(datos.token, datos.usuario);

            document.getElementById("contrasenaLogin").value = "";

            mostrarReporte();

        } catch (error) {

            console.error(error);

            fijarTexto(
                "avisoLogin",
                "No se pudo conectar con el servidor. Si está encendido, " +
                "abre la consola (F12) y revisa si es un error de CORS."
            );

        }

    }

);


// ========================================
// PEDIR EL REPORTE A LA API
// ========================================

async function cargarReporte() {

    const fecha = document.getElementById("campoFecha").value;

    fijarTexto("avisoReporte", "");

    if (fecha === "") {

        fijarTexto("avisoReporte", "Elige una fecha.");

        return;

    }


    try {

        const respuesta = await fetch(

            API + "/reportes/diario?fecha=" + encodeURIComponent(fecha),

            {
                headers: {
                    "Authorization": "Bearer " + obtenerToken()
                }
            }

        );

        // 401: el token venció o no es válido
        if (respuesta.status === 401) {

            cerrarSesionReporte("Tu sesión expiró. Inicia sesión de nuevo.");

            return;

        }

        const datos = await respuesta.json();

        if (!respuesta.ok) {

            fijarTexto(
                "avisoReporte",
                datos.mensaje || "No se pudo generar el reporte."
            );

            return;

        }

        dibujarReporte(datos);

    } catch (error) {

        console.error(error);

        fijarTexto(
            "avisoReporte",
            "No se pudo conectar con el servidor."
        );

    }

}


// ========================================
// DIBUJAR EL REPORTE
// ========================================

function dibujarReporte(datos) {

    const r = datos.resumen;

    // El título de la pestaña será el nombre sugerido al guardar el PDF
    document.title = "Reporte diario " + datos.fecha;


    // ---------- Encabezado ----------

    fijarTexto(
        "repAlcance",
        datos.alcance === "doctor"
            ? "Dr(a). " + datos.doctor
            : "Toda la clínica"
    );

    fijarTexto("repFecha", fechaLarga(datos.fecha));

    fijarTexto(
        "repGenerado",
        "Reporte generado el " +
        new Date(datos.generadoEn).toLocaleString("es")
    );


    // ---------- Tarjetas ----------

    fijarTexto("kpiTotal", r.totalCitas);

    fijarTexto("kpiCompletadas", r.completadas);

    fijarTexto("kpiPacientes", r.pacientesAtendidos);

    fijarTexto("kpiIngresos", dinero(r.ingresosTotal));

    fijarTexto("kpiTicket", dinero(r.ticketPromedio));

    fijarTexto("kpiEspera", r.esperaPromedioMin + " min");


    // ---------- Detalle ----------

    fijarTexto("detPendientes", r.pendientes);

    fijarTexto("detCanceladas", r.canceladas);

    fijarTexto("detNoAsistio", r.noAsistio);

    fijarTexto("detApp", r.porApp);

    fijarTexto("detManuales", r.manuales);

    fijarTexto("detConsulta", r.consultaPromedioMin + " min");


    // ---------- Gráfica: citas por estado ----------

    dibujarGrafica({

        idCanvas: "grafEstado",

        idVacio: "vacioEstado",

        tipo: "doughnut",

        etiquetas: datos.citasPorEstado.map(function(fila) {

            return fila.estado;

        }),

        valores: datos.citasPorEstado.map(function(fila) {

            return fila.cantidad;

        }),

        colores: ["#16a34a", "#2563eb", "#dc2626", "#d97706"],

        esDinero: false

    });


    // ---------- Gráfica: ingresos por método de pago ----------

    dibujarGrafica({

        idCanvas: "grafMetodo",

        idVacio: "vacioMetodo",

        tipo: "bar",

        etiquetas: datos.ingresosPorMetodo.map(function(fila) {

            return capitalizar(fila.metodo_pago);

        }),

        valores: datos.ingresosPorMetodo.map(function(fila) {

            return fila.total;

        }),

        colores: "#2563eb",

        esDinero: true

    });


    // ---------- Gráfica: citas por hora ----------

    dibujarGrafica({

        idCanvas: "grafHora",

        idVacio: "vacioHora",

        tipo: "bar",

        etiquetas: datos.citasPorHora.map(function(fila) {

            return fila.hora;

        }),

        valores: datos.citasPorHora.map(function(fila) {

            return fila.cantidad;

        }),

        colores: "#0d9488",

        esDinero: false

    });


    // ---------- Tablas ----------

    llenarTabla(

        "tablaMetodoCuerpo",

        3,

        datos.ingresosPorMetodo.map(function(fila) {

            return [
                capitalizar(fila.metodo_pago),
                String(fila.cantidad),
                dinero(fila.total)
            ];

        })

    );

    // El desglose por doctor solo lo ve el administrador
    const cajaPorDoctor = document.getElementById("cajaPorDoctor");

    if (datos.alcance === "clinica") {

        cajaPorDoctor.classList.remove("oculto");

        llenarTabla(

            "tablaDoctorCuerpo",

            3,

            datos.porDoctor.map(function(fila) {

                return [
                    fila.doctor,
                    String(fila.citas),
                    dinero(fila.ingresos)
                ];

            })

        );

    } else {

        cajaPorDoctor.classList.add("oculto");

    }

}


// ========================================
// LLENAR UNA TABLA (con textContent, sin innerHTML)
// ========================================

function llenarTabla(idCuerpo, numeroColumnas, filas) {

    const cuerpo = document.getElementById(idCuerpo);

    cuerpo.replaceChildren();

    if (filas.length === 0) {

        const filaVacia = document.createElement("tr");

        const celdaVacia = document.createElement("td");

        celdaVacia.colSpan = numeroColumnas;

        celdaVacia.className = "vacio";

        celdaVacia.textContent = "Sin datos";

        filaVacia.appendChild(celdaVacia);

        cuerpo.appendChild(filaVacia);

        return;

    }

    filas.forEach(function(textos) {

        const fila = document.createElement("tr");

        textos.forEach(function(texto) {

            const celda = document.createElement("td");

            celda.textContent = texto;

            fila.appendChild(celda);

        });

        cuerpo.appendChild(fila);

    });

}


// ========================================
// DIBUJAR UNA GRÁFICA
// ========================================

function dibujarGrafica(config) {

    const canvas = document.getElementById(config.idCanvas);

    const mensajeVacio = document.getElementById(config.idVacio);

    // Si ya había una gráfica en este canvas, se destruye primero
    if (graficas[config.idCanvas]) {

        graficas[config.idCanvas].destroy();

        delete graficas[config.idCanvas];

    }

    const hayDatos = config.valores.some(function(valor) {

        return valor > 0;

    });

    canvas.classList.toggle("oculto", !hayDatos);

    mensajeVacio.classList.toggle("oculto", hayDatos);

    if (!hayDatos) {

        return;

    }


    const opciones = {

        responsive: true,

        maintainAspectRatio: false,

        // Sin animación: así la gráfica ya está completa al imprimir
        animation: false,

        plugins: {

            legend: {

                display: config.tipo === "doughnut",

                position: "bottom"

            },

            tooltip: {

                callbacks: {

                    label: function(contexto) {

                        const valor =
                            typeof contexto.parsed === "number"
                                ? contexto.parsed
                                : contexto.parsed.y;

                        if (config.tipo === "doughnut") {

                            return " " + contexto.label + ": " + valor;

                        }

                        return " " + (
                            config.esDinero ? dinero(valor) : valor
                        );

                    }

                }

            }

        }

    };

    if (config.tipo === "bar") {

        const ejeY = {

            beginAtZero: true,

            ticks: { precision: 0 }

        };

        if (config.esDinero) {

            ejeY.ticks = {

                callback: function(valor) {

                    return SIMBOLO_MONEDA + valor;

                }

            };

        }

        opciones.scales = { y: ejeY };

    }


    graficas[config.idCanvas] = new Chart(canvas, {

        type: config.tipo,

        data: {

            labels: config.etiquetas,

            datasets: [{

                data: config.valores,

                backgroundColor: config.colores,

                borderWidth: config.tipo === "doughnut" ? 2 : 0,

                borderRadius: config.tipo === "bar" ? 6 : 0

            }]

        },

        options: opciones

    });

}


// ========================================
// BOTONES Y EVENTOS
// ========================================

document.getElementById("btnImprimir").addEventListener(

    "click",

    function() {

        window.print();

    }

);

document.getElementById("btnSalir").addEventListener(

    "click",

    function() {

        cerrarSesionReporte("");

    }

);

document.getElementById("campoFecha").addEventListener(

    "change",

    cargarReporte

);


// Antes y después de imprimir, las gráficas se ajustan al
// ancho de la hoja
window.addEventListener("beforeprint", function() {

    Object.values(graficas).forEach(function(grafica) {

        grafica.resize();

    });

});

window.addEventListener("afterprint", function() {

    Object.values(graficas).forEach(function(grafica) {

        grafica.resize();

    });

});


// ========================================
// AL ABRIR LA PÁGINA
// ========================================

document.getElementById("campoFecha").value = fechaDeHoy();

if (obtenerToken()) {

    mostrarReporte();

} else {

    mostrarLogin("");

}