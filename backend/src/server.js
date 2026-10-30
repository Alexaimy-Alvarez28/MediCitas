
const express = require("express");

const app = express();

app.use(express.json());


app.get("/api/salud", function(peticion, respuesta) {

    respuesta.json({
        estado: "ok",
        mensaje: "API de MediCitas funcionando"
    });

});

app.get("/api/doctores", function(peticion, respuesta) {

    respuesta.json([
        { nombre: "Ana Pérez", especialidad: "Pediatría" },
        { nombre: "Luis Gómez", especialidad: "Cardiología" }
    ]);

});
const PUERTO = 3000;

app.listen(PUERTO, function() {

    console.log("Servidor corriendo en http://localhost:" + PUERTO);

});