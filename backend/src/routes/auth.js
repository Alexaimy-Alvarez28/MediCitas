const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { verificarToken } = require("../middlewares/auth");

const router = express.Router();


router.post("/registro", async function(peticion, respuesta) {

    const nombre = String(peticion.body.nombre || "").trim();

    const correo =
        String(peticion.body.correo || "").trim().toLowerCase();

    const telefono = String(peticion.body.telefono || "").trim();

    const contrasena = String(peticion.body.contrasena || "");


    // ---------- Validaciones ----------

    if (nombre === "" || correo === "" || contrasena === "") {

        return respuesta.status(400).json({
            mensaje: "Nombre, correo y contraseña son obligatorios"
        });

    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {

        return respuesta.status(400).json({
            mensaje: "El correo no tiene un formato válido"
        });

    }

    if (contrasena.length < 8) {

        return respuesta.status(400).json({
            mensaje: "La contraseña debe tener al menos 8 caracteres"
        });

    }


    let cliente;

    try {


        const hash = await bcrypt.hash(contrasena, 10);

        cliente = await pool.connect();

        await cliente.query("BEGIN");

        const usuario = await cliente.query(
            "INSERT INTO usuarios (correo, contrasena_hash, rol) " +
            "VALUES ($1, $2, 'paciente') RETURNING id",
            [correo, hash]
        );

        await cliente.query(
            "INSERT INTO pacientes (usuario_id, nombre, telefono) " +
            "VALUES ($1, $2, $3)",
            [usuario.rows[0].id, nombre, telefono || null]
        );

        await cliente.query("COMMIT");

        respuesta.status(201).json({
            mensaje: "Cuenta creada correctamente"
        });

    } catch (error) {

        if (cliente) {

            await cliente.query("ROLLBACK");

        }


        if (error.code === "23505") {

            return respuesta.status(409).json({
                mensaje: "Ya existe una cuenta con ese correo"
            });

        }

        console.error(error);

        respuesta.status(500).json({
            mensaje: "Error al crear la cuenta"
        });

    } finally {

    
        if (cliente) {

            cliente.release();

        }

    }

});


router.post("/login", async function(peticion, respuesta) {

    const correo =
        String(peticion.body.correo || "").trim().toLowerCase();

    const contrasena = String(peticion.body.contrasena || "");

    if (correo === "" || contrasena === "") {

        return respuesta.status(400).json({
            mensaje: "Correo y contraseña son obligatorios"
        });

    }


    try {

        const resultado = await pool.query(
            "SELECT id, correo, contrasena_hash, rol, activo " +
            "FROM usuarios WHERE correo = $1",
            [correo]
        );

        const usuario = resultado.rows[0];


        const mensajeError = "Correo o contraseña incorrectos";

        if (!usuario || !usuario.activo) {

            return respuesta.status(401).json({ mensaje: mensajeError });

        }

        const coincide =
            await bcrypt.compare(contrasena, usuario.contrasena_hash);

        if (!coincide) {

            return respuesta.status(401).json({ mensaje: mensajeError });

        }


        const token = jwt.sign(

            { id: usuario.id, rol: usuario.rol },

            process.env.JWT_SECRET,

            { expiresIn: process.env.JWT_EXPIRES || "8h" }

        );

        respuesta.json({

            token: token,

            usuario: {
                id: usuario.id,
                correo: usuario.correo,
                rol: usuario.rol
            }

        });

    } catch (error) {

        console.error(error);

        respuesta.status(500).json({
            mensaje: "Error al iniciar sesión"
        });

    }

});


router.get("/yo", verificarToken, async function(peticion, respuesta) {

    try {

        const resultado = await pool.query(
            "SELECT id, correo, rol FROM usuarios WHERE id = $1",
            [peticion.usuario.id]
        );

        if (resultado.rows.length === 0) {

            return respuesta.status(404).json({
                mensaje: "Usuario no encontrado"
            });

        }

        respuesta.json(resultado.rows[0]);

    } catch (error) {

        console.error(error);

        respuesta.status(500).json({
            mensaje: "Error al obtener el usuario"
        });

    }

});

module.exports = router;