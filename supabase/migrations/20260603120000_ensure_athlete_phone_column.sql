-- Ensure the phone column exists on athletes table (safe no-op if already present)
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS phone VARCHAR;
