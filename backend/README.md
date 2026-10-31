# MediCitas - Backend

API REST para el sistema de citas médicas MediCitas.

## Tecnologías
Node.js · Express · PostgreSQL · JWT · bcryptjs

## Requisitos
- Node.js (LTS)
- PostgreSQL 18

## Instalación
1. `npm install`
2. Crear una base de datos llamada `medicitas` y ejecutar `db/schema.sql`
3. Copiar `.env.example` a `.env` y completar los valores
4. Crear el primer administrador:
   `node src/scripts/crear-admin.js correo contrasena`
5. `npm run dev`

## Endpoints actuales
| Método | Ruta | Acceso |
|---|---|---|
| GET | /api/salud | Público |
| GET | /api/doctores | Público |
| GET | /api/doctores/:id | Público |
| POST | /api/auth/registro | Público (pacientes) |
| POST | /api/auth/login | Público |
| GET | /api/auth/yo | Usuario autenticado |

## Pruebas manuales
El archivo `pruebas.http` (extensión REST Client de VS Code) contiene
peticiones de ejemplo.