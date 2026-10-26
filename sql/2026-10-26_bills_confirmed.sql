CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    service_type VARCHAR(20) NOT NULL,
    provider_code VARCHAR(40) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    consumption NUMERIC(12, 2) NOT NULL,
    consumption_unit VARCHAR(3) NOT NULL,
    amount_clp INTEGER NOT NULL,
    due_date DATE NOT NULL,
    entry_source VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS service_type VARCHAR(20);
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS provider_code VARCHAR(40);
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS consumption NUMERIC(12, 2);
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS consumption_unit VARCHAR(3);
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS amount_clp INTEGER;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS entry_source VARCHAR(20);
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.bills DROP COLUMN IF EXISTS metadata;
ALTER TABLE public.bills DROP COLUMN IF EXISTS ocr_result;
ALTER TABLE public.bills DROP COLUMN IF EXISTS imagen_url;
ALTER TABLE public.bills DROP COLUMN IF EXISTS image_url;
ALTER TABLE public.bills DROP COLUMN IF EXISTS tipo;
ALTER TABLE public.bills DROP COLUMN IF EXISTS consumo;
ALTER TABLE public.bills DROP COLUMN IF EXISTS monto;
ALTER TABLE public.bills DROP COLUMN IF EXISTS periodo;

ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_service_type_check;
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_consumption_unit_check;
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_consumption_check;
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_amount_check;
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_period_check;
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_due_date_check;
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_entry_source_check;

ALTER TABLE public.bills ADD CONSTRAINT bills_service_type_check CHECK (service_type IN ('electricity', 'water'));
ALTER TABLE public.bills ADD CONSTRAINT bills_consumption_unit_check CHECK ((service_type = 'electricity' AND consumption_unit = 'kWh') OR (service_type = 'water' AND consumption_unit = 'm3'));
ALTER TABLE public.bills ADD CONSTRAINT bills_consumption_check CHECK (consumption > 0);
ALTER TABLE public.bills ADD CONSTRAINT bills_amount_check CHECK (amount_clp >= 0);
ALTER TABLE public.bills ADD CONSTRAINT bills_period_check CHECK (period_start <= period_end);
ALTER TABLE public.bills ADD CONSTRAINT bills_due_date_check CHECK (due_date >= period_end);
ALTER TABLE public.bills ADD CONSTRAINT bills_entry_source_check CHECK (entry_source IN ('ocr_confirmed', 'manual'));

CREATE INDEX IF NOT EXISTS idx_bills_family_period ON public.bills (family_id, period_end DESC);
