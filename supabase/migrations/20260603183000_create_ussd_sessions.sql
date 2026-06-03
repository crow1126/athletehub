-- Migration: create ussd_sessions table
CREATE TABLE IF NOT EXISTS public.ussd_sessions (
  session_id         TEXT PRIMARY KEY,
  phone              TEXT NOT NULL,
  current_menu       TEXT NOT NULL DEFAULT 'main',
  accumulated_input  TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ussd_sessions ENABLE ROW LEVEL SECURITY;

-- Note: No public policies are needed as this table is accessed exclusively
-- by our webhook using the service_role client.
