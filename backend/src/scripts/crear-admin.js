require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("../db");


async function crearAdmin() {

    const correo =
        String(process.argv[2] || "").trim().toLowerCase();

    const contrasena =
        String(process.argv[3] || "");


    if (correo === "" || contrasena.length < 8) {

        console.log(
            "Uso: node src/scripts/crear-admin.js correo contrasena"
        );

        console.log("La contraseña debe tener al menos 8 caracteres.");

        return;

    }


    try {

        const hash = await bcrypt.hash(contrasena, 10);

        await pool.query(
            "INSERT INTO usuarios (correo, contrasena_hash, rol) " +
            "VALUES ($1, $2, 'admin')",
            [correo, hash]
        );

        console.log("Administrador creado: " + correo);

    } catch (error) {

        if (error.code === "23505") {

            console.log("Ya existe un usuario con ese correo.");

        } else {

            console.error(error);

        }

    } finally {

        
        await pool.end();

    }

}

crearAdmin();