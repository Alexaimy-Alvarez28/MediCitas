// ========================================
// SERVIDOR DE MEDICITAS
// ========================================

// IMPORTANTE: va primero, para que las variables del .env
// estén disponibles antes de crear la conexión
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();


// ========================================
// CORS: QUÉ PÁGINAS PUEDEN USAR ESTA API
// ========================================
// Lista de orígenes permitidos. Por defecto, Live Server.
// Se puede cambiar con la variable CORS_ORIGINS en el .env
// (varios orígenes separados por comas).
// ========================================

const origenesPermitidos =
    (process.env.CORS_ORIGINS ||
        "http://127.0.0.1:5500,http://localhost:5500")
        .split(",")
        .map(function(origen) {

            return origen.trim();

        });

app.use(cors({

    origin: function(origen, devolver) {

        // Sin "origen" = no es un navegador (REST Client, pruebas)
        if (!origen || origenesPermitidos.includes(origen)) {

            return devolver(null, true);

        }

        // Origen no autorizado: no se envían permisos CORS
        // y el navegador bloquea la respuesta
        devolver(null, false);

    }

}));


// Permite que el servidor entienda JSON en las peticiones
app.use(express.json());


// ========================================
// RUTAS
// ========================================

app.use("/api/auth", require("./routes/auth"));

app.use("/api/doctores", require("./routes/doctores"));

app.use("/api/pacientes", require("./routes/pacientes"));

app.use("/api/citas", require("./routes/citas"));

// El cobro (PATCH /api/citas/:id/pago) vive en su propio archivo
app.use("/api/citas", require("./routes/cobros"));

app.use("/api/reportes", require("./routes/reportes"));


// Ruta de salud (también prueba la base de datos)
app.get("/api/salud", async function(peticion, respuesta) {

    try {

        const resultado =
            await pool.query("SELECT NOW() AS hora_servidor");

        respuesta.json({
            estado: "ok",
            mensaje: "API de MediCitas funcionando",
            baseDeDatos: "conectada",
            horaServidor: resultado.rows[0].hora_servidor
        });

    } catch (error) {

        console.error(error);

        respuesta.status(500).json({
            estado: "error",
            mensaje: "No se pudo conectar a la base de datos"
        });

    }

});


const PUERTO = process.env.PORT || 3000;

app.listen(PUERTO, function() {

    console.log("Servidor corriendo en http://localhost:" + PUERTO);

});