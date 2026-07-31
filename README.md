# MediCitas

Sistema web de agendamiento de citas médicas que conecta pacientes y doctores en una sola plataforma, con roles y paneles independientes para cada tipo de usuario.

## Descripción

MediCitas permite a los pacientes registrarse, agendar citas por área médica, dar seguimiento a su historial y gestionar su información médica y de contacto de emergencia. Los doctores, por su parte, pueden confirmar o cancelar las citas que reciben, llevar el control de sus pacientes y mantener actualizado su perfil profesional. Todo el flujo —desde el registro hasta la confirmación de una cita— se refleja en tiempo real mediante un sistema de notificaciones para ambos roles.

## Características principales

- **Autenticación por rol**: registro e inicio de sesión diferenciado para pacientes y doctores.
- **Panel del paciente**: agendar citas filtradas por área médica y disponibilidad de doctores, ver próxima cita activa, historial completo, y marcar citas como completadas.
- **Panel del doctor**: cola de citas pendientes por confirmar, citas confirmadas en espera de atención, historial de pacientes y estadísticas generales (total de pacientes, citas pendientes, citas completadas).
- **Notificaciones**: alertas automáticas al paciente cuando el doctor confirma o cancela una cita, y al doctor cuando el paciente cancela una cita ya confirmada.
- **Perfil extendido**: datos personales, información médica (alergias, tipo de sangre, dirección) y contacto de emergencia para pacientes; especialidad y estadísticas para doctores.
- **Interfaz responsive** construida con HTML, CSS y JavaScript puro, sin frameworks ni dependencias externas.

## Tecnologías

HTML5 · CSS3 · JavaScript (Vanilla) · `localStorage` como capa de persistencia

## Estructura del proyecto

```
MediCitas/
├── index.html
├── login.html
├── registro.html
├── dashboard-paciente.html
├── dashboard-doctor.html
├── estilos.css
└── js/
    ├── datos.js
    ├── dashboard-paciente.js
    └── dashboard-doctor.js
```

## Cómo probarlo

1. Clona el repositorio.
2. Abre `index.html` con Live Server (o cualquier servidor local).
3. Regístrate como Paciente o como Doctor desde la pantalla de registro.
4. Inicia sesión para ver el panel correspondiente a tu rol.
