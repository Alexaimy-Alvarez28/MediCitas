-- ========================================
-- MIGRACIÓN 001
-- Tiempos de atención y una consulta a la vez
-- ========================================

ALTER TABLE citas
    ADD COLUMN IF NOT EXISTS hora_llegada TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS hora_inicio TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS hora_fin TIMESTAMPTZ;

-- Un doctor solo puede tener UNA cita "En consulta" a la vez
CREATE UNIQUE INDEX IF NOT EXISTS una_consulta_a_la_vez
    ON citas (doctor_id)
    WHERE estado = 'En consulta';