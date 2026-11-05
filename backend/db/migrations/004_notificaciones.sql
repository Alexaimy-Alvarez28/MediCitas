-- ========================================
-- MIGRACIÓN 004
-- Notificaciones
-- ========================================
-- Se puede ejecutar varias veces sin error.
-- ========================================

CREATE TABLE IF NOT EXISTS notificaciones (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    mensaje TEXT NOT NULL,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notificaciones_por_usuario
    ON notificaciones (usuario_id, creado_en DESC);