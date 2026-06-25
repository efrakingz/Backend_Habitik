-- ============================================================
-- Habitik: Esquema Completo para PostgreSQL (Sprint 1)
-- Compatible con Postgres 13+ (usa gen_random_uuid() nativo)
-- ============================================================

-- 1. Tabla de Usuarios (Credenciales y Seguridad)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Familias (Grupos)
CREATE TABLE IF NOT EXISTS public.families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    family_code VARCHAR(100) UNIQUE,
    meta_luz INTEGER DEFAULT 0,
    meta_agua INTEGER DEFAULT 0,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Perfiles de Usuario
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    avatar_letra VARCHAR(5) DEFAULT 'U',
    avatar_color VARCHAR(10) DEFAULT '#2e7d32',
    avatar_url TEXT,
    rol VARCHAR(50) DEFAULT 'miembro', -- 'miembro' | 'jefe' | 'jefa' | 'co-admin'
    family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
    xp INTEGER DEFAULT 0,
    nivel INTEGER DEFAULT 1,
    monedas INTEGER DEFAULT 0,
    trivia_correct_count INTEGER DEFAULT 0,
    trivia_last_updated VARCHAR(100),
    daily_bonus_claimed_at VARCHAR(100),
    onboarding_answers JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Evidencias (Feed)
CREATE TABLE IF NOT EXISTS public.evidences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    autor VARCHAR(100) NOT NULL,
    avatar VARCHAR(5) DEFAULT 'U',
    color VARCHAR(10) DEFAULT '#2e7d32',
    avatar_url TEXT,
    accion VARCHAR(255) NOT NULL,
    descripcion TEXT,
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    xp INTEGER DEFAULT 0,
    emoji VARCHAR(10) DEFAULT '🌟',
    imagen_url TEXT
);

-- 5. Tabla de Tareas y Retos
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    tarea VARCHAR(255) NOT NULL,
    asignado_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    hecho BOOLEAN DEFAULT FALSE,
    xp INTEGER DEFAULT 0,
    tipo VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabla de Recibos (Luz y Agua)
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- 'luz' | 'agua'
    consumo VARCHAR(50) NOT NULL,
    monto VARCHAR(50) NOT NULL,
    periodo VARCHAR(50) NOT NULL,
    empresa VARCHAR(100),
    cuenta VARCHAR(100),
    tarifa VARCHAR(100),
    imagen_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabla de Recompensas de la Tienda
CREATE TABLE IF NOT EXISTS public.family_rewards (
    id BIGINT PRIMARY KEY, -- millisecondsSinceEpoch generado por el cliente
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    emoji VARCHAR(10) DEFAULT '🎁',
    costo INTEGER DEFAULT 100,
    disponible BOOLEAN DEFAULT TRUE,
    creador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    last_redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabla de Validaciones de Retos (Espera del Jefe)
CREATE TABLE IF NOT EXISTS public.reto_validations (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    usuario VARCHAR(100) NOT NULL,
    avatar VARCHAR(5) DEFAULT 'U',
    color VARCHAR(10) DEFAULT '#2e7d32',
    reto VARCHAR(255) NOT NULL,
    hora VARCHAR(50) DEFAULT 'Recién',
    xp INTEGER DEFAULT 0,
    monedas INTEGER DEFAULT 0,
    evidencias TEXT[] DEFAULT '{}',
    requiere_evidencia BOOLEAN DEFAULT FALSE,
    estado VARCHAR(50) DEFAULT 'pendiente', -- 'pendiente' | 'aprobado' | 'rechazado'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tabla de Logros Desbloqueados
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    logro_key VARCHAR(100) NOT NULL,
    desbloqueado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, logro_key)
);

-- 10. Tabla de Notificaciones
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    desc_text TEXT NOT NULL,
    icon_code VARCHAR(50) DEFAULT 'notifications',
    color_hex VARCHAR(10) DEFAULT '#388E3C',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Tabla de Tokens QR para Familias
CREATE TABLE IF NOT EXISTS public.qr_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    token VARCHAR(100) UNIQUE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Tabla de Registro de Ducha (Sprint 1)
CREATE TABLE IF NOT EXISTS public.shower_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    duracion_segundos INTEGER NOT NULL,
    estado VARCHAR(50) NOT NULL, -- 'valido' | 'invalido'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creación de Índices para optimizar velocidad de consulta
CREATE INDEX IF NOT EXISTS idx_profiles_family ON public.profiles(family_id);
CREATE INDEX IF NOT EXISTS idx_evidences_family ON public.evidences(family_id);
CREATE INDEX IF NOT EXISTS idx_tasks_family ON public.tasks(family_id);
CREATE INDEX IF NOT EXISTS idx_bills_family ON public.bills(family_id);
CREATE INDEX IF NOT EXISTS idx_family_rewards_family ON public.family_rewards(family_id);
CREATE INDEX IF NOT EXISTS idx_reto_validations_family_estado ON public.reto_validations(family_id, estado);
CREATE INDEX IF NOT EXISTS idx_achievements_user ON public.achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON public.qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_shower_logs_user ON public.shower_logs(user_id);
