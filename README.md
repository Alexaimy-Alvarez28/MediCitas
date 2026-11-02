# MediCitas - Backend

API REST para el sistema de citas médicas MediCitas: un sistema privado
que se instala en clínicas, con cuenta de doctor (compartida con su
recepción), pacientes con app y cola de espera.

## Tecnologías
Node.js · Express · PostgreSQL · JWT · bcryptjs

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
| GET | /api/doctores/:id | Usuario autenticado |
| POST | /api/doctores | Administrador |
| POST | /api/pacientes | Doctor / recepción |
| GET | /api/pacientes?buscar= | Doctor / recepción |
| POST | /api/citas | Paciente o doctor |
| GET | /api/citas | Paciente o doctor (solo las suyas) |
| PATCH | /api/citas/:id/cancelar | Dueño de la cita |
| PATCH | /api/citas/:id/estado | Doctor / recepción |
| GET | /api/citas/cola?fecha= | Doctor / recepción |

## Estados de una cita
Pendiente → Confirmada → En sala → En consulta → Completada
(también: Cancelada, No asistio)

## Pruebas manuales
Los archivos `.http` (extensión REST Client de VS Code) contienen
peticiones de ejemplo.