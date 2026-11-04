-- ========================================
-- MIGRACIÓN 003
-- Datos de perfil del paciente
-- ========================================
-- Se puede ejecutar varias veces sin error.
-- ========================================

ALTER TABLE pacientes
    ADD COLUMN IF NOT EXISTS direccion TEXT,
    ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre VARCHAR(120),
    ADD COLUMN IF NOT EXISTS contacto_emergencia_parentesco VARCHAR(30),
    ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono VARCHAR(30);