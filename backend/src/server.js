require("dotenv").config();

const express = require("express");
const pool = require("./db");

const app = express();

app.use(express.json());


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


app.get("/api/doctores", async function(peticion, respuesta) {

    try {

        const resultado = await pool.query(
            "SELECT id, nombre, especialidad, precio_consulta " +
            "FROM doctores ORDER BY nombre"
        );

        respuesta.json(resultado.rows);

    } catch (error) {

        console.error(error);

        respuesta.status(500).json({
            mensaje: "Error al obtener los doctores"
        });

    }

});


app.get("/api/doctores/:id", async function(peticion, respuesta) {

    try {

        const id = Number(peticion.params.id);

        if (!Number.isInteger(id)) {

            return respuesta.status(400).json({
                mensaje: "El id debe ser un número"
            });

        }

        const resultado = await pool.query(
            "SELECT id, nombre, especialidad, precio_consulta " +
            "FROM doctores WHERE id = $1",
            [id]
        );

        if (resultado.rows.length === 0) {

            return respuesta.status(404).json({
                mensaje: "Doctor no encontrado"
            });

        }

        respuesta.json(resultado.rows[0]);

    } catch (error) {

        console.error(error);

        respuesta.status(500).json({
            mensaje: "Error al obtener el doctor"
        });

    }

});


const PUERTO = process.env.PORT || 3000;

app.listen(PUERTO, function() {

    console.log("Servidor corriendo en http://localhost:" + PUERTO);

});