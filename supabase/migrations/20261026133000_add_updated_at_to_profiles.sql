-- Add updated_at column to profiles table if it does not already exist
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
