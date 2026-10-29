-- ============================================================
-- Migración: Tabla de Códigos de Recuperación de Contraseña
-- Fecha: 2026-10-28
-- Descripción: Almacena códigos OTP de 6 dígitos numéricos
-- con TTL de 15 minutos para recuperación segura de cuenta (2FA/Email).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.password_reset_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(20) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de alto rendimiento para validación y caducidad de códigos
CREATE INDEX IF NOT EXISTS idx_password_reset_email ON public.password_reset_codes (email);
CREATE INDEX IF NOT EXISTS idx_password_reset_code ON public.password_reset_codes (code);
CREATE INDEX IF NOT EXISTS idx_password_reset_active ON public.password_reset_codes (email, code, used);
