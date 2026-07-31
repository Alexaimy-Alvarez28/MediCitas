// ========================================
// PANEL DEL PACIENTE - LÓGICA
// ========================================


// Usuario actualmente conectado
let usuarioActual = null;

// Guarda el id de la cita que se está mostrando como "próxima cita"
let idProximaCitaActiva = null;


// ========================================
// CONVERTIR HORA "8:00 AM" A MINUTOS DEL DÍA
// ========================================
// Necesario para poder ordenar correctamente,
// ya que como texto "2:00 PM" sale antes que
// "9:00 AM" alfabéticamente (lo cual es incorrecto).
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
// VERIFICAR SESIÓN AL CARGAR LA PÁGINA
// ========================================

document.addEventListener("DOMContentLoaded", function() {

    usuarioActual =
        obtenerUsuarioSesion();


    // Si no hay sesión activa, regresar al login
    if (!usuarioActual) {

        window.location.href = "login.html";

        return;

    }


    // Si el usuario es doctor, no debe ver el panel de paciente
    if (usuarioActual.tipo === "doctor") {

        alert(
            "El panel de doctor todavía está en construcción."
        );

        window.location.href = "login.html";

        return;

    }


    // Mostrar el nombre del paciente en el saludo
    const primerNombre =
        usuarioActual.nombre.split(" ")[0];

    document.getElementById("tituloBienvenida").textContent =
        "Bienvenido, " + primerNombre;


    // Llenar la sección de datos personales
    document.getElementById("perfilNombre").value =
        usuarioActual.nombre;

    document.getElementById("perfilCorreo").value =
        usuarioActual.correo;

    document.getElementById("perfilTelefono").value =
        usuarioActual.telefono;

    document.getElementById("perfilTipo").value =
        usuarioActual.tipo === "paciente" ? "Paciente" : "Doctor";


    // Cargar información médica y de contacto de emergencia
    // (si el paciente ya la había guardado antes)
    document.getElementById("perfilAlergias").value =
        usuarioActual.alergias || "";

    document.getElementById("perfilTipoSangre").value =
        usuarioActual.tipoSangre || "";

    document.getElementById("perfilDireccion").value =
        usuarioActual.direccion || "";

    if (usuarioActual.contactoEmergencia) {

        document.getElementById("perfilEmergenciaNombre").value =
            usuarioActual.contactoEmergencia.nombre || "";

        document.getElementById("perfilEmergenciaParentesco").value =
            usuarioActual.contactoEmergencia.parentesco || "";

        document.getElementById("perfilEmergenciaTelefono").value =
            usuarioActual.contactoEmergencia.telefono || "";

    }


    // Cargar doctores disponibles en el formulario de citas
    cargarDoctoresDisponibles();


    // Cargar toda la información de citas
    actualizarVistaCitas();


    // Cargar notificaciones del paciente
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

            return notificacion.usuarioId === usuarioActual.id;

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

            if (notificacion.usuarioId === usuarioActual.id) {

                notificacion.leida = true;

            }

        });

        guardarNotificaciones(notificaciones);


        actualizarNotificaciones();

        // Volver a mostrar el panel (actualizarNotificaciones no lo toca,
        // pero lo dejamos explícito por claridad)
        document.getElementById("panelNotificaciones").classList.remove("oculto");

    }

}


// ========================================
// GUARDAR INFORMACIÓN MÉDICA Y DE EMERGENCIA
// ========================================

function guardarPerfilPaciente() {

    const alergias =
        document.getElementById("perfilAlergias").value.trim();

    const tipoSangre =
        document.getElementById("perfilTipoSangre").value;

    const direccion =
        document.getElementById("perfilDireccion").value.trim();

    const emergenciaNombre =
        document.getElementById("perfilEmergenciaNombre").value.trim();

    const emergenciaParentesco =
        document.getElementById("perfilEmergenciaParentesco").value;

    const emergenciaTelefono =
        document.getElementById("perfilEmergenciaTelefono").value.trim();


    const avisoEmergenciaTelefono =
        document.getElementById("avisoEmergenciaTelefono");


    // El teléfono de emergencia no puede ser el mismo
    // que el teléfono personal del paciente
    if (
        emergenciaTelefono !== "" &&
        emergenciaTelefono === usuarioActual.telefono
    ) {

        avisoEmergenciaTelefono.classList.remove("oculto");

        alert(
            "El teléfono de emergencia no puede ser el mismo " +
            "que tu teléfono personal."
        );

        return;

    }


    avisoEmergenciaTelefono.classList.add("oculto");


    const usuarios =
        obtenerUsuarios();

    const posicion =
        usuarios.findIndex(function(usuario) {

            return usuario.id === usuarioActual.id;

        });


    if (posicion === -1) {

        return;

    }


    usuarios[posicion].alergias = alergias;

    usuarios[posicion].tipoSangre = tipoSangre;

    usuarios[posicion].direccion = direccion;

    usuarios[posicion].contactoEmergencia = {

        nombre: emergenciaNombre,

        parentesco: emergenciaParentesco,

        telefono: emergenciaTelefono

    };


    guardarUsuarios(usuarios);


    // Actualizar el usuario en memoria
    usuarioActual = usuarios[posicion];


    alert("Perfil actualizado correctamente.");

}

function mostrarSeccionPaciente(idSeccion) {

    const secciones =
        document.querySelectorAll(".seccion-dashboard");

    secciones.forEach(function(seccion) {

        seccion.classList.add("oculto");

    });


    const mapaSecciones = {

        inicio: "seccionInicio",

        citas: "seccionCitas",

        agendar: "seccionAgendar",

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
    // nombre; en las demás secciones se muestra
    // el nombre de la sección.
    // ========================================

    const mapaTitulos = {

        inicio: "Bienvenido, " + usuarioActual.nombre.split(" ")[0],

        citas: "Mis citas",

        agendar: "Agendar cita",

        perfil: "Perfil"

    };

    document.getElementById("tituloBienvenida").textContent =
        mapaTitulos[idSeccion];


    // Si se entra a "Agendar cita", refrescar la lista de doctores
    // (por si se registraron nuevos doctores después de cargar la página)
    if (idSeccion === "agendar") {

        cargarDoctoresDisponibles();

    }


    // Marcar el botón activo en el menú lateral
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
// OBTENER SOLO LAS CITAS DEL PACIENTE ACTUAL
// ========================================

function obtenerCitasDelPaciente() {

    const todasLasCitas =
        obtenerCitasMedicitas();

    return todasLasCitas.filter(function(cita) {

        return cita.pacienteId === usuarioActual.id;

    });

}


// ========================================
// CARGAR DOCTORES DISPONIBLES EN EL SELECT
// ========================================
// Solo se muestran los doctores registrados
// con la especialidad que el paciente eligió.
// ========================================

function cargarDoctoresDisponibles() {

    const especialidadElegida =
        document.getElementById("especialidadCita").value;

    const select =
        document.getElementById("doctorCita");

    const aviso =
        document.getElementById("avisoDoctor");


    // Limpiar opciones (dejando la primera)
    select.innerHTML =
        '<option value="">Selecciona un doctor</option>';


    // Si todavía no eligió área, no se muestra nada
    if (especialidadElegida === "") {

        aviso.textContent =
            "Selecciona primero un área.";

        aviso.classList.remove("oculto");

        select.disabled = true;

        return;

    }


    const usuarios =
        obtenerUsuarios();

    const doctores =
        usuarios.filter(function(usuario) {

            return (
                usuario.tipo === "doctor" &&
                usuario.especialidad === especialidadElegida
            );

        });


    if (doctores.length === 0) {

        aviso.textContent =
            "No hay doctores disponibles de esa área. " +
            "Favor seleccionar otra especialidad.";

        aviso.classList.remove("oculto");

        select.disabled = true;

        return;

    }


    aviso.classList.add("oculto");

    select.disabled = false;


    doctores.forEach(function(doctor) {

        const opcion =
            document.createElement("option");

        opcion.value = doctor.id;

        opcion.textContent = "Dr(a). " + doctor.nombre;

        select.appendChild(opcion);

    });

}


// ========================================
// CONFIRMAR NUEVA CITA
// ========================================

function confirmarCita() {

    const especialidad =
        document.getElementById("especialidadCita").value;

    const doctorId =
        document.getElementById("doctorCita").value;

    const fecha =
        document.getElementById("fechaCita").value;

    const hora =
        document.getElementById("horaCita").value;


    if (
        especialidad === "" ||
        doctorId === "" ||
        fecha === "" ||
        hora === ""
    ) {

        alert("Por favor, completa todos los campos de la cita.");

        return;

    }


    const usuarios =
        obtenerUsuarios();

    const doctor =
        usuarios.find(function(usuario) {

            return usuario.id === Number(doctorId);

        });


    if (!doctor) {

        alert("No se pudo encontrar el doctor seleccionado.");

        return;

    }


    const nuevaCita = {

        id: Date.now(),

        pacienteId: usuarioActual.id,

        especialidad: especialidad,

        doctorId: doctor.id,

        doctorNombre: doctor.nombre,

        fecha: fecha,

        hora: hora,

        estado: "Pendiente"

    };


    const citas =
        obtenerCitasMedicitas();

    citas.push(nuevaCita);

    guardarCitasMedicitas(citas);


    alert("Cita agendada correctamente.");


    // Limpiar formulario
    document.getElementById("especialidadCita").value = "";

    document.getElementById("doctorCita").value = "";

    document.getElementById("fechaCita").value = "";

    document.getElementById("horaCita").value = "";


    // Actualizar vistas y regresar al dashboard
    actualizarVistaCitas();

    mostrarSeccionPaciente("citas");

}


// ========================================
// CANCELAR LA PRÓXIMA CITA (LA QUE SE MUESTRA EN EL BANNER)
// ========================================

function cancelarProximaCita() {

    if (idProximaCitaActiva === null) {

        alert("No tienes citas para cancelar.");

        return;

    }


    const todasLasCitas =
        obtenerCitasMedicitas();

    const citaACancelar =
        todasLasCitas.find(function(cita) {

            return cita.id === idProximaCitaActiva;

        });


    if (!citaACancelar) {

        return;

    }


    const confirmacion =
        confirm(
            "¿Deseas cancelar tu cita de " +
            citaACancelar.especialidad +
            " el " +
            citaACancelar.fecha +
            " a las " +
            citaACancelar.hora +
            "?"
        );


    if (!confirmacion) {

        return;

    }


    const posicion =
        todasLasCitas.findIndex(function(cita) {

            return cita.id === citaACancelar.id;

        });


    // Si la cita ya estaba confirmada por el doctor, se le
    // notifica que el paciente la canceló (si solo estaba
    // "Pendiente" de confirmar, el doctor no llega a
    // notificarse porque nunca llegó a confirmarla)
    if (citaACancelar.estado === "Confirmada") {

        crearNotificacion(

            citaACancelar.doctorId,

            "El paciente " + usuarioActual.nombre +
            " canceló su cita de " + citaACancelar.especialidad +
            " que tenías confirmada para el " +
            citaACancelar.fecha +
            " a las " +
            citaACancelar.hora +
            "."

        );

    }


    todasLasCitas[posicion].estado = "Cancelada";

    guardarCitasMedicitas(todasLasCitas);


    alert("La cita ha sido cancelada.");


    actualizarVistaCitas();

}


// ========================================
// MARCAR LA PRÓXIMA CITA COMO COMPLETADA
// ========================================
// Al completarla, deja de contar como "activa" y
// automáticamente se proyecta la siguiente cita
// (Pendiente o Confirmada) más próxima en fecha/hora.
// ========================================

function completarProximaCita() {

    if (idProximaCitaActiva === null) {

        return;

    }


    const todasLasCitas =
        obtenerCitasMedicitas();

    const posicion =
        todasLasCitas.findIndex(function(cita) {

            return cita.id === idProximaCitaActiva;

        });


    if (posicion === -1) {

        return;

    }


    todasLasCitas[posicion].estado = "Completada";

    guardarCitasMedicitas(todasLasCitas);


    alert("Cita marcada como completada.");


    actualizarVistaCitas();

}


// ========================================
// ACTUALIZAR TODAS LAS VISTAS RELACIONADAS A CITAS
// ========================================

function actualizarVistaCitas() {

    const citasPaciente =
        obtenerCitasDelPaciente();


    // ========================================
    // BANNER Y HISTORIAL EN INICIO
    // ========================================

    const bannerTitulo =
        document.getElementById("bannerTitulo");

    const bannerTexto =
        document.getElementById("bannerTexto");

    const btnCompletar =
        document.getElementById("btnCompletarProxima");


    // Una cita sigue "activa" (cuenta como próxima) mientras
    // esté Pendiente o Confirmada. Solo desaparece cuando el
    // paciente la marca como Completada, o si es Cancelada.
    const citasActivas =
        citasPaciente.filter(function(cita) {

            return (
                cita.estado === "Pendiente" ||
                cita.estado === "Confirmada"
            );

        });

    const citasActivasOrdenadas =
        ordenarCitasPorFechaHora(citasActivas);

    const proximaCita =
        citasActivasOrdenadas[0] || null;


    if (!proximaCita) {

        idProximaCitaActiva = null;

        bannerTitulo.textContent =
            "No tienes citas agendadas";

        bannerTexto.textContent =
            "Agenda tu primera cita médica usando el botón de abajo";

        btnCompletar.classList.add("oculto");

    } else {

        idProximaCitaActiva = proximaCita.id;

        bannerTitulo.textContent =
            "Tienes " + citasActivasOrdenadas.length + " cita(s) agendada(s)";

        bannerTexto.textContent =
            "Próxima cita: " +
            proximaCita.especialidad +
            " el " +
            proximaCita.fecha +
            " a las " +
            proximaCita.hora;

        btnCompletar.classList.remove("oculto");

    }


    const historialCitas =
        document.getElementById("historialCitas");

    renderizarListaCitas(historialCitas, citasPaciente);


    // ========================================
    // SECCIÓN "MIS CITAS"
    // ========================================

    const listaMisCitas =
        document.getElementById("listaMisCitas");

    if (citasPaciente.length === 0) {

        listaMisCitas.innerHTML = `

            <p class="texto-vacio">No tienes citas registradas aún</p>

            <div class="centrado">

                <button
                    class="btn btn-primario"
                    onclick="mostrarSeccionPaciente('agendar')">

                    Agendar primera cita

                </button>

            </div>

        `;

    } else {

        renderizarListaCitas(listaMisCitas, citasPaciente);

    }

}


// ========================================
// DIBUJAR UNA LISTA DE CITAS EN UN CONTENEDOR
// ========================================

function renderizarListaCitas(contenedor, citas) {

    if (citas.length === 0) {

        contenedor.innerHTML =
            '<p class="texto-vacio">No tienes citas registradas aún</p>';

        return;

    }


    // Mostrar primero la cita más reciente en registrarse
    // (la última que se agregó al arreglo)
    const citasOrdenadas =
        citas.slice().reverse();


    let html = "";

    citasOrdenadas.forEach(function(cita) {

        html = html + `

            <div class="fila-cita">

                <div>

                    <strong>${cita.especialidad}</strong>

                    <p>Dr(a). ${cita.doctorNombre}</p>

                    <p>${cita.fecha} - ${cita.hora}</p>

                </div>

                <span class="etiqueta-estado etiqueta-${cita.estado.toLowerCase()}">

                    ${cita.estado}

                </span>

            </div>

        `;

    });


    contenedor.innerHTML = html;

}