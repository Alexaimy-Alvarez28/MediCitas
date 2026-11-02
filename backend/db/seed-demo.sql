-- ========================================
-- DATOS DE DEMOSTRACIÓN
-- ========================================
-- SOLO para desarrollo y demos. NUNCA ejecutar en una
-- instalación real de una clínica.
--
-- Requisitos: que existan los doctores
--   dr.carlos@clinica.com y dra.lucia@clinica.com
--
-- Crea un día completo (2026-11-01) con citas en todos los
-- estados y cobros por distintos métodos de pago.
-- Se puede ejecutar varias veces sin duplicar datos.
-- ========================================

-- Pacientes de demostración (sin cuenta en la app)
INSERT INTO pacientes (nombre, telefono, documento) VALUES
    ('Carmen Valdez',  '(555) 400-0001', 'DEMO-001'),
    ('José Peña',      '(555) 400-0002', 'DEMO-002'),
    ('Marta Núñez',    '(555) 400-0003', 'DEMO-003'),
    ('Ramón Cruz',     '(555) 400-0004', 'DEMO-004'),
    ('Elena Soto',     '(555) 400-0005', 'DEMO-005'),
    ('Pablo Rivas',    '(555) 400-0006', 'DEMO-006'),
    ('Sofía Méndez',   '(555) 400-0007', 'DEMO-007'),
    ('Andrés Lora',    '(555) 400-0008', 'DEMO-008')
ON CONFLICT DO NOTHING;


-- Citas del día
INSERT INTO citas (
    paciente_id, doctor_id, fecha, hora, estado, origen, motivo,
    hora_llegada, hora_inicio, hora_fin, monto, metodo_pago, pagado_en
)
SELECT
    p.id,
    d.id,
    DATE '2026-11-01',
    v.hora::time,
    v.estado,
    v.origen,
    v.motivo,
    v.llegada::timestamptz,
    v.inicio::timestamptz,
    v.fin::timestamptz,
    v.monto::numeric,
    v.metodo,
    CASE WHEN v.monto IS NOT NULL THEN v.fin::timestamptz END
FROM (VALUES
    -- Dr. Carlos
    ('DEMO-001', 'dr.carlos@clinica.com', '08:00', 'Completada',  'app',    'Control general',   '2026-11-01 07:50', '2026-11-01 08:05', '2026-11-01 08:30', 2000, 'efectivo'),
    ('DEMO-002', 'dr.carlos@clinica.com', '09:00', 'Completada',  'manual', 'Dolor de pecho',    '2026-11-01 08:55', '2026-11-01 09:10', '2026-11-01 09:40', 2000, 'tarjeta'),
    ('DEMO-003', 'dr.carlos@clinica.com', '10:00', 'Completada',  'app',    'Presión alta',      '2026-11-01 10:00', '2026-11-01 10:25', '2026-11-01 10:50', 1500, 'seguro'),
    ('DEMO-004', 'dr.carlos@clinica.com', '11:00', 'Completada',  'manual', 'Chequeo cardíaco',  '2026-11-01 10:45', '2026-11-01 11:05', '2026-11-01 11:35', 2000, 'efectivo'),
    ('DEMO-005', 'dr.carlos@clinica.com', '13:00', 'No asistio',  'app',    'Control',           NULL, NULL, NULL, NULL, NULL),
    ('DEMO-006', 'dr.carlos@clinica.com', '14:00', 'Cancelada',   'app',    'Control',           NULL, NULL, NULL, NULL, NULL),
    ('DEMO-007', 'dr.carlos@clinica.com', '15:00', 'En consulta', 'manual', 'Palpitaciones',     '2026-11-01 14:50', '2026-11-01 15:10', NULL, NULL, NULL),
    ('DEMO-008', 'dr.carlos@clinica.com', '16:00', 'En sala',     'app',    'Seguimiento',       '2026-11-01 15:55', NULL, NULL, NULL, NULL),
    -- Dra. Lucía
    ('DEMO-001', 'dra.lucia@clinica.com', '09:00', 'Completada',  'manual', 'Control niño sano', '2026-11-01 08:50', '2026-11-01 09:05', '2026-11-01 09:30', 1200, 'transferencia'),
    ('DEMO-002', 'dra.lucia@clinica.com', '10:00', 'Completada',  'app',    'Fiebre',            '2026-11-01 09:55', '2026-11-01 10:10', '2026-11-01 10:40', 1200, 'efectivo'),
    ('DEMO-003', 'dra.lucia@clinica.com', '11:00', 'Confirmada',  'app',    'Vacunación',        NULL, NULL, NULL, NULL, NULL)
) AS v(documento, correo_doctor, hora, estado, origen, motivo,
       llegada, inicio, fin, monto, metodo)
JOIN pacientes p ON p.documento = v.documento
JOIN usuarios u ON u.correo = v.correo_doctor
JOIN doctores d ON d.usuario_id = u.id
ON CONFLICT DO NOTHING;