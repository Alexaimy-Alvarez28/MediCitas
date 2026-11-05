# MediCitas - Backend

API REST para el sistema de citas médicas MediCitas: un sistema privado
que se instala en clínicas, con cuenta de doctor (compartida con su
recepción), pacientes con app, cola de espera, cobros y reporte diario.

## Tecnologías
Node.js · Express · PostgreSQL · JWT · bcryptjs · CORS

## Requisitos
- Node.js (LTS)
- PostgreSQL 18

## Instalación
1. `npm install`
2. Crear una base de datos llamada `medicitas` y ejecutar `db/schema.sql`
   (en una base que ya existía antes de un cambio, ejecutar en orden los
   archivos de `db/migrations/`)
3. Copiar `.env.example` a `.env` y completar los valores
4. Crear el primer administrador:
   `node src/scripts/crear-admin.js correo contrasena`
5. `npm run dev`

## Endpoints
| Método | Ruta | Acceso |
|---|---|---|
| GET | /api/salud | Público |
| POST | /api/auth/registro | Público (pacientes) |
| POST | /api/auth/login | Público |
| GET | /api/auth/yo | Usuario autenticado |
| GET | /api/doctores | Usuario autenticado |
| GET | /api/doctores/yo | Doctor |
| PUT | /api/doctores/yo | Doctor |
| GET | /api/doctores/:id | Usuario autenticado |
| GET | /api/doctores/:id/disponibilidad?fecha= | Usuario autenticado |
| POST | /api/doctores | Administrador |
| GET | /api/pacientes/yo | Paciente |
| PUT | /api/pacientes/yo | Paciente |
| POST | /api/pacientes | Doctor / recepción |
| GET | /api/pacientes?buscar= | Doctor / recepción |
| POST | /api/citas | Paciente o doctor |
| GET | /api/citas | Paciente o doctor (solo las suyas) |
| GET | /api/citas/cola?fecha= | Doctor / recepción |
| PATCH | /api/citas/:id/estado | Doctor / recepción |
| PATCH | /api/citas/:id/cancelar | Dueño de la cita |
| PATCH | /api/citas/:id/pago | Doctor / recepción |
| GET | /api/reportes/diario?fecha= | Doctor o administrador |
| GET | /api/notificaciones | Usuario autenticado |
| PATCH | /api/notificaciones/leer | Usuario autenticado |

## Estados de una cita
Pendiente → Confirmada → En sala → En consulta → Completada
(también: Cancelada, No asistio)

## Datos de demostración
`db/seed-demo.sql` crea un día de ejemplo para probar el reporte.
Solo para desarrollo: nunca ejecutarlo en una instalación real.

## Pruebas manuales
Los archivos `.http` (extensión REST Client de VS Code) contienen
peticiones de ejemplo.