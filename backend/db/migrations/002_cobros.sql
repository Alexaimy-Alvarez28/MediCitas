-- ========================================
-- MIGRACIÓN 002
-- Cobros de las citas
-- ========================================
-- Se ejecuta UNA sola vez.
-- ========================================

ALTER TABLE citas
    ADD COLUMN IF NOT EXISTS monto NUMERIC(10, 2) CHECK (monto >= 0),
    ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(20)
        CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'seguro', 'transferencia')),
    ADD COLUMN IF NOT EXISTS pagado_en TIMESTAMPTZ;

-- Los tres datos del cobro van siempre juntos: o están los tres o ninguno
ALTER TABLE citas
    ADD CONSTRAINT pago_consistente CHECK (
        (monto IS NULL AND metodo_pago IS NULL AND pagado_en IS NULL)
        OR
        (monto IS NOT NULL AND metodo_pago IS NOT NULL AND pagado_en IS NOT NULL)
    );