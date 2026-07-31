// ========================================
// PANEL DEL DOCTOR - LÓGICA
// ========================================


// Usuario (doctor) actualmente conectado
let doctorActual = null;


// ========================================
// VERIFICAR SESIÓN AL CARGAR LA PÁGINA
// ========================================

document.addEventListener("DOMContentLoaded", function() {

    doctorActual =
        obtenerUsuarioSesion();


    // Si no hay sesión activa, regresar al login
    if (!doctorActual) {

        window.location.href = "login.html";

        return;

    }


    // Si el usuario es paciente, no debe ver el panel de doctor
    if (doctorActual.tipo !== "doctor") {

        window.location.href = "dashboard-paciente.html";

        return;

    }


    // Mostrar el nombre del doctor en el saludo
    document.getElementById("tituloBienvenida").textContent =
        "Bienvenido, Dr. " + doctorActual.nombre;


    // Llenar el encabezado de perfil
    document.getElementById("perfilAvatar").textContent =
        doctorActual.nombre.charAt(0).toUpperCase();

    document.getElementById("perfilNombreCorto").textContent =
        "Dr. " + doctorActual.nombre;

    document.getElementById("perfilEspecialidadCorta").textContent =
        doctorActual.especialidad;


    // Llenar los campos editables del formulario de perfil
    document.getElementById("perfilNombre").value =
        doctorActual.nombre;

    document.getElementById("perfilEspecialidad").value =
        doctorActual.especialidad;

    document.getElementById("perfilCorreo").value =
        doctorActual.correo;

    document.getElementById("perfilTelefono").value =
        doctorActual.telefono;


    // Cargar toda la información de pacientes y citas
    actualizarPanelDoctor();


    // Cargar notificaciones del doctor
    actualizarNotificaciones();

});


// ========================================
// NOTIFICACIONES
// ========================================

function actualizarNotificaciones() {

    const notificaciones =
        obtenerNotificaciones();

    const notificacionesPropias =
        notificaciones.filter(function(notificacion) {

            return notificacion.usuarioId === doctorActual.id;

        });


    // Mostrar las más recientes primero
    notificacionesPropias.reverse();


    // ========================================
    // CONTADOR (BURBUJA ROJA)
    // ========================================

    const noLeidas =
        notificacionesPropias.filter(function(notificacion) {

            return notificacion.leida === false;

        });

    const contador =
        document.getElementById("contadorNotificaciones");

    if (noLeidas.length === 0) {

        contador.classList.add("oculto");

    } else {

        contador.textContent = noLeidas.length;

        contador.classList.remove("oculto");

    }


    // ========================================
    // LISTA DENTRO DEL PANEL
    // ========================================

    const lista =
        document.getElementById("listaNotificaciones");

    if (notificacionesPropias.length === 0) {

        lista.innerHTML =
            '<p class="texto-vacio">No tienes notificaciones</p>';

        return;

    }


    let html = "";

    notificacionesPropias.forEach(function(notificacion) {

        html = html + `

            <div class="notificacion-item ${notificacion.leida ? "" : "notificacion-nueva"}">

                ${notificacion.mensaje}

            </div>

        `;

    });

    lista.innerHTML = html;

}


// ========================================
// ABRIR/CERRAR EL PANEL Y MARCAR COMO LEÍDAS
// ========================================

function alternarPanelNotificaciones() {

    const panel =
        document.getElementById("panelNotificaciones");

    panel.classList.toggle("oculto");


    // Al abrir el panel, se marcan todas como leídas
    if (!panel.classList.contains("oculto")) {

        const notificaciones =
            obtenerNotificaciones();

        notificaciones.forEach(function(notificacion) {

            if (notificacion.usuarioId === doctorActual.id) {

                notificacion.leida = true;

            }

        });

        guardarNotificaciones(notificaciones);


        actualizarNotificaciones();

        document.getElementById("panelNotificaciones").classList.remove("oculto");

    }

}


// ========================================
// NAVEGACIÓN ENTRE SECCIONES
// ========================================

function mostrarSeccionDoctor(idSeccion) {

    const secciones =
        document.querySelectorAll(".seccion-dashboard");

    secciones.forEach(function(seccion) {

        seccion.classList.add("oculto");

    });


    const mapaSecciones = {

        inicio: "seccionInicio",

        pacientes: "seccionPacientes",

        perfil: "seccionPerfil"

    };


    const seccionAMostrar =
        document.getElementById(mapaSecciones[idSeccion]);

    if (seccionAMostrar) {

        seccionAMostrar.classList.remove("oculto");

    }


    // ========================================
    // TÍTULO DEL ENCABEZADO SEGÚN LA SECCIÓN
    // ========================================
    // Solo en Inicio se muestra el saludo con el
    // nombre del doctor; en las demás secciones se
    // muestra el nombre de la sección.
    // ========================================

    const mapaTitulos = {

        inicio: "Bienvenido, Dr. " + doctorActual.nombre,

        pacientes: "Mis pacientes",

        perfil: "Perfil"

    };

    document.getElementById("tituloBienvenida").textContent =
        mapaTitulos[idSeccion];


    const botonesNav =
        document.querySelectorAll(".nav-item");

    botonesNav.forEach(function(boton) {

        boton.classList.remove("activo");

        if (boton.dataset.seccion === idSeccion) {

            boton.classList.add("activo");

        }

    });

}


// ========================================
// CONVERTIR HORA "8:00 AM" A MINUTOS DEL DÍA
// ========================================
// Esto permite ordenar correctamente las citas
// por hora, ya que como texto "2:00 PM" sale antes
// que "9:00 AM" en orden alfabético (lo cual sería
// incorrecto).
// ========================================

function convertirHoraAMinutos(horaTexto) {

    const partes =
        horaTexto.split(" ");

    const horaMinuto =
        partes[0].split(":");

    let horas =
        Number(horaMinuto[0]);

    const minutos =
        Number(horaMinuto[1]);

    const periodo =
        partes[1];


    if (periodo === "PM" && horas !== 12) {

        horas = horas + 12;

    }

    if (periodo === "AM" && horas === 12) {

        horas = 0;

    }


    return (horas * 60) + minutos;

}


// ========================================
// ORDENAR CITAS POR FECHA Y HORA (ASCENDENTE)
// ========================================

function ordenarCitasPorFechaHora(citas) {

    const copia =
        citas.slice();

    copia.sort(function(citaA, citaB) {

        if (citaA.fecha !== citaB.fecha) {

            return citaA.fecha < citaB.fecha ? -1 : 1;

        }


        const minutosA =
            convertirHoraAMinutos(citaA.hora);

        const minutosB =
            convertirHoraAMinutos(citaB.hora);

        return minutosA - minutosB;

    });

    return copia;

}


// ========================================
// OBTENER SOLO LAS CITAS DE ESTE DOCTOR
// ========================================

function obtenerCitasDelDoctor() {

    const todasLasCitas =
        obtenerCitasMedicitas();

    return todasLasCitas.filter(function(cita) {

        return cita.doctorId === doctorActual.id;

    });

}


// ========================================
// ACTUALIZAR TODO EL PANEL (TARJETAS, LISTAS)
// ========================================

function actualizarPanelDoctor() {

    const citasDoctor =
        obtenerCitasDelDoctor();


    // ========================================
    // TOTAL DE PACIENTES (SIN REPETIR)
    // ========================================

    const idsPacientesUnicos = [];

    citasDoctor.forEach(function(cita) {

        if (idsPacientesUnicos.indexOf(cita.pacienteId) === -1) {

            idsPacientesUnicos.push(cita.pacienteId);

        }

    });


    // ========================================
    // CITAS SEGÚN SU ESTADO
    // ========================================
    // - "Pendiente"  = recién agendada por el paciente,
    //                  todavía sin revisar por el doctor.
    // - "Confirmada" = el doctor ya la confirmó; cuenta
    //                  como "Citas pendientes" porque el
    //                  paciente todavía no ha sido atendido.
    // - "Completada" = la consulta ya se realizó.
    // - "Cancelada"  = cancelada por el doctor.
    // ========================================

    const citasPorConfirmar =
        citasDoctor.filter(function(cita) {

            return cita.estado === "Pendiente";

        });

    const citasPendientesDeVisita =
        citasDoctor.filter(function(cita) {

            return cita.estado === "Confirmada";

        });

    const citasCompletadas =
        citasDoctor.filter(function(cita) {

            return cita.estado === "Completada";

        });


    // ========================================
    // TARJETAS RESUMEN (INICIO)
    // ========================================

    document.getElementById("totalPacientes").textContent =
        idsPacientesUnicos.length;

    document.getElementById("totalPendientes").textContent =
        citasPendientesDeVisita.length;

    document.getElementById("totalCompletadas").textContent =
        citasCompletadas.length;


    // ========================================
    // TARJETAS RESUMEN (DENTRO DE PERFIL)
    // ========================================

    document.getElementById("statPacientes").textContent =
        idsPacientesUnicos.length;

    document.getElementById("statPendientes").textContent =
        citasPendientesDeVisita.length;


    // ========================================
    // LISTA: CITAS PENDIENTES DE CONFIRMACIÓN
    // ========================================

    const listaPendientes =
        document.getElementById("listaPendientesConfirmar");

    if (citasPorConfirmar.length === 0) {

        listaPendientes.innerHTML =
            '<p class="texto-vacio">No tienes citas pendientes de confirmación</p>';

    } else {

        const usuarios =
            obtenerUsuarios();

        let html = "";

        citasPorConfirmar.forEach(function(cita) {

            const paciente =
                usuarios.find(function(usuario) {

                    return usuario.id === cita.pacienteId;

                });

            const nombrePaciente =
                paciente ? paciente.nombre : "Paciente";


            html = html + `

                <div class="fila-cita">

                    <div>

                        <strong>${nombrePaciente}</strong>

                        <p>${cita.especialidad}</p>

                        <p>${cita.fecha} - ${cita.hora}</p>

                    </div>

                    <button
                        class="btn btn-primario btn-pequeno"
                        onclick="confirmarCitaDoctor(${cita.id})">

                        Confirmar

                    </button>

                </div>

            `;

        });

        listaPendientes.innerHTML = html;

    }


    // ========================================
    // LISTA: CITAS PENDIENTES (YA CONFIRMADAS,
    // ESPERANDO LA CONSULTA)
    // ========================================

    const listaCitasPendientes =
        document.getElementById("listaCitasPendientes");

    if (citasPendientesDeVisita.length === 0) {

        listaCitasPendientes.innerHTML =
            '<p class="texto-vacio">No tienes citas pendientes</p>';

    } else {

        const usuarios =
            obtenerUsuarios();

        const citasOrdenadas =
            ordenarCitasPorFechaHora(citasPendientesDeVisita);

        let html = "";

        citasOrdenadas.forEach(function(cita) {

            const paciente =
                usuarios.find(function(usuario) {

                    return usuario.id === cita.pacienteId;

                });

            const nombrePaciente =
                paciente ? paciente.nombre : "Paciente";


            html = html + `

                <div class="fila-cita">

                    <div>

                        <strong>${nombrePaciente}</strong>

                        <p>${cita.especialidad}</p>

                        <p>${cita.fecha} - ${cita.hora}</p>

                    </div>

                    <div class="acciones-cita">

                        <button
                            class="btn btn-peligro btn-pequeno"
                            onclick="cancelarCitaDoctor(${cita.id})">

                            Cancelar

                        </button>

                        <button
                            class="btn btn-primario btn-pequeno"
                            onclick="completarCitaDoctor(${cita.id})">

                            Completada

                        </button>

                    </div>

                </div>

            `;

        });

        listaCitasPendientes.innerHTML = html;

    }


    // ========================================
    // LISTA: HISTORIAL DE PACIENTES
    // ========================================

    const historialPacientes =
        document.getElementById("historialPacientes");

    if (citasDoctor.length === 0) {

        historialPacientes.innerHTML =
            '<p class="texto-vacio">No tienes pacientes registrados aún</p>';

    } else {

        const usuarios =
            obtenerUsuarios();

        // Mostrar primero la cita más reciente en registrarse
        const citasOrdenadas =
            citasDoctor.slice().reverse();

        let html = "";

        citasOrdenadas.forEach(function(cita) {

            const paciente =
                usuarios.find(function(usuario) {

                    return usuario.id === cita.pacienteId;

                });

            const nombrePaciente =
                paciente ? paciente.nombre : "Paciente";


            html = html + `

                <div class="fila-cita">

                    <div>

                        <strong>${nombrePaciente}</strong>

                        <p>${cita.especialidad}</p>

                        <p>${cita.fecha} - ${cita.hora}</p>

                    </div>

                    <span class="etiqueta-estado etiqueta-${cita.estado.toLowerCase()}">

                        ${cita.estado}

                    </span>

                </div>

            `;

        });

        historialPacientes.innerHTML = html;

    }

}


// ========================================
// CONFIRMAR UNA CITA PENDIENTE
// ========================================

function confirmarCitaDoctor(idCita) {

    const citas =
        obtenerCitasMedicitas();

    const posicion =
        citas.findIndex(function(cita) {

            return cita.id === idCita;

        });


    if (posicion === -1) {

        return;

    }


    citas[posicion].estado = "Confirmada";

    guardarCitasMedicitas(citas);


    // Notificar al paciente
    const citaConfirmada =
        citas[posicion];

    crearNotificacion(

        citaConfirmada.pacienteId,

        "Tu cita de " + citaConfirmada.especialidad +
        " con el Dr(a). " + doctorActual.nombre +
        " el " + citaConfirmada.fecha +
        " a las " + citaConfirmada.hora +
        " ha sido confirmada."

    );


    alert("Cita confirmada correctamente.");


    actualizarPanelDoctor();

}


// ========================================
// MARCAR UNA CITA CONFIRMADA COMO COMPLETADA
// ========================================

function completarCitaDoctor(idCita) {

    const citas =
        obtenerCitasMedicitas();

    const posicion =
        citas.findIndex(function(cita) {

            return cita.id === idCita;

        });


    if (posicion === -1) {

        return;

    }


    citas[posicion].estado = "Completada";

    guardarCitasMedicitas(citas);


    alert("Cita marcada como completada.");


    actualizarPanelDoctor();

}


// ========================================
// CANCELAR UNA CITA YA CONFIRMADA
// ========================================

function cancelarCitaDoctor(idCita) {

    const citas =
        obtenerCitasMedicitas();

    const posicion =
        citas.findIndex(function(cita) {

            return cita.id === idCita;

        });


    if (posicion === -1) {

        return;

    }


    const cita =
        citas[posicion];


    const confirmacion =
        confirm(
            "¿Deseas cancelar la cita de " +
            cita.especialidad +
            " el " +
            cita.fecha +
            " a las " +
            cita.hora +
            "?"
        );


    if (!confirmacion) {

        return;

    }


    citas[posicion].estado = "Cancelada";

    guardarCitasMedicitas(citas);


    // Notificar al paciente
    crearNotificacion(

        cita.pacienteId,

        "Tu cita de " + cita.especialidad +
        " con el Dr(a). " + doctorActual.nombre +
        " el " + cita.fecha +
        " a las " + cita.hora +
        " ha sido cancelada por el doctor."

    );


    alert("La cita ha sido cancelada.");


    actualizarPanelDoctor();

}


// ========================================
// GUARDAR CAMBIOS DEL PERFIL DEL DOCTOR
// ========================================

function guardarPerfilDoctor() {

    const nombre =
        document.getElementById("perfilNombre").value.trim();

    const especialidad =
        document.getElementById("perfilEspecialidad").value;

    const correo =
        document.getElementById("perfilCorreo").value.trim();

    const telefono =
        document.getElementById("perfilTelefono").value.trim();


    if (
        nombre === "" ||
        correo === "" ||
        telefono === ""
    ) {

        alert("Por favor, completa todos los campos.");

        return;

    }


    const usuarios =
        obtenerUsuarios();

    const posicion =
        usuarios.findIndex(function(usuario) {

            return usuario.id === doctorActual.id;

        });


    if (posicion === -1) {

        return;

    }


    usuarios[posicion].nombre = nombre;

    usuarios[posicion].especialidad = especialidad;

    usuarios[posicion].correo = correo;

    usuarios[posicion].telefono = telefono;


    guardarUsuarios(usuarios);


    // Actualizar el usuario en memoria y refrescar la pantalla
    doctorActual = usuarios[posicion];

    document.getElementById("tituloBienvenida").textContent =
        "Bienvenido, Dr. " + doctorActual.nombre;

    document.getElementById("perfilAvatar").textContent =
        doctorActual.nombre.charAt(0).toUpperCase();

    document.getElementById("perfilNombreCorto").textContent =
        "Dr. " + doctorActual.nombre;

    document.getElementById("perfilEspecialidadCorta").textContent =
        doctorActual.especialidad;


    alert("Perfil actualizado correctamente.");

}