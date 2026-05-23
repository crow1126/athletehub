-- Migration to add date_of_birth column to public.athletes
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS date_of_birth DATE;
