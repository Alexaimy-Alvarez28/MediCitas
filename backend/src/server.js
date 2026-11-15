
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

// ========================================
// CONFIGURACIÓN DE CORS
// ========================================

const origenesPermitidos =
    (process.env.CORS_ORIGINS ||
        "http://127.0.0.1:5500,http://localhost:5500")
        .split(",")
        .map(origen => origen.trim());

app.use(cors({
    origin: function(origen, devolver) {
        if (!origen || origenesPermitidos.includes(origen)) {
            return devolver(null, true);
        }

        devolver(null, false);
    }
}));

// ========================================
// RECIBIR DATOS JSON
// ========================================

app.use(express.json({ limit: "100kb" }));

// ========================================
// RUTAS ORIGINALES
// ========================================

app.use("/api/auth", require("./routes/auth"));

app.use("/api/doctores", require("./routes/doctores"));

app.use("/api/pacientes", require("./routes/pacientes"));

app.use("/api/citas", require("./routes/citas"));

app.use("/api/citas", require("./routes/cobros"));

app.use("/api/reportes", require("./routes/reportes"));

app.use("/api/notificaciones", require("./routes/notificaciones"));

// ========================================
// LECCIÓN 13: ADMINISTRADOR
// ========================================

app.use("/api/admin", require("./routes/admin"));

// ========================================
// VERIFICAR ESTADO DEL SERVIDOR
// ========================================

app.get("/api/salud", async function(req, res) {
    try {
        const resultado = await pool.query(
            "SELECT NOW() AS hora_servidor"
        );

        res.json({
            estado: "ok",
            mensaje: "API de MediCitas funcionando",
            baseDeDatos: "conectada",
            horaServidor: resultado.rows[0].hora_servidor
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            estado: "error",
            mensaje: "No se pudo conectar a la base de datos"
        });
    }
});

// ========================================
// RUTAS NO ENCONTRADAS
// ========================================

app.use(function(req, res) {
    res.status(404).json({
        mensaje: "Ruta no encontrada"
    });
});

// ========================================
// INICIAR SERVIDOR
// ========================================

const PUERTO = process.env.PORT || 3000;

app.listen(PUERTO, function() {
    console.log(
        "Servidor MediCitas funcionando en http://localhost:" +
        PUERTO
    );
});
