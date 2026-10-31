-- ========================================
-- MEDICITAS: ESTRUCTURA DE LA BASE DE DATOS
-- ========================================
-- Se puede ejecutar varias veces sin error
-- (IF NOT EXISTS evita duplicar tablas).
-- ========================================

CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    correo VARCHAR(150) NOT NULL UNIQUE,
    contrasena_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'doctor', 'paciente')),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctores (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id),
    nombre VARCHAR(120) NOT NULL,
    especialidad VARCHAR(60) NOT NULL,
    telefono VARCHAR(30),
    precio_consulta NUMERIC(10, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pacientes (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id INTEGER UNIQUE REFERENCES usuarios(id),
    nombre VARCHAR(120) NOT NULL,
    telefono VARCHAR(30),
    documento VARCHAR(30) UNIQUE,
    fecha_nacimiento DATE,
    alergias TEXT,
    tipo_sangre VARCHAR(20),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS citas (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id),
    doctor_id INTEGER NOT NULL REFERENCES doctores(id),
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
        CHECK (estado IN ('Pendiente', 'Confirmada', 'En sala',
                          'En consulta', 'Completada', 'Cancelada', 'No asistio')),
    origen VARCHAR(10) NOT NULL DEFAULT 'app'
        CHECK (origen IN ('app', 'manual')),
    motivo TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Impide dos citas del mismo doctor a la misma fecha y hora,
-- salvo las canceladas, que liberan el espacio
CREATE UNIQUE INDEX IF NOT EXISTS citas_sin_doble_reserva
    ON citas (doctor_id, fecha, hora)
    WHERE estado <> 'Cancelada';