-- ========================================
-- MEDICITAS: ESTRUCTURA DE LA BASE DE DATOS
-- ========================================
-- Para una instalación NUEVA basta con ejecutar este archivo.
-- (Las migraciones de db/migrations sirven para bases que ya
-- existían antes de cada cambio.)
-- Se puede ejecutar varias veces sin error.
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
    direccion TEXT,
    alergias TEXT,
    tipo_sangre VARCHAR(20),
    contacto_emergencia_nombre VARCHAR(120),
    contacto_emergencia_parentesco VARCHAR(30),
    contacto_emergencia_telefono VARCHAR(30),
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
    hora_llegada TIMESTAMPTZ,
    hora_inicio TIMESTAMPTZ,
    hora_fin TIMESTAMPTZ,
    monto NUMERIC(10, 2) CHECK (monto >= 0),
    metodo_pago VARCHAR(20)
        CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'seguro', 'transferencia')),
    pagado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pago_consistente CHECK (
        (monto IS NULL AND metodo_pago IS NULL AND pagado_en IS NULL)
        OR
        (monto IS NOT NULL AND metodo_pago IS NOT NULL AND pagado_en IS NOT NULL)
    )
);

-- Impide dos citas del mismo doctor a la misma fecha y hora,
-- salvo las canceladas, que liberan el espacio
CREATE UNIQUE INDEX IF NOT EXISTS citas_sin_doble_reserva
    ON citas (doctor_id, fecha, hora)
    WHERE estado <> 'Cancelada';

-- Un doctor solo puede tener UNA cita "En consulta" a la vez
CREATE UNIQUE INDEX IF NOT EXISTS una_consulta_a_la_vez
    ON citas (doctor_id)
    WHERE estado = 'En consulta';

CREATE TABLE IF NOT EXISTS notificaciones (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    mensaje TEXT NOT NULL,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notificaciones_por_usuario
    ON notificaciones (usuario_id, creado_en DESC);