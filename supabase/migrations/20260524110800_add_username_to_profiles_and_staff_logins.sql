-- Migration to add username support for staff logins
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username VARCHAR;
ALTER TABLE public.staff_logins ADD COLUMN IF NOT EXISTS username VARCHAR;

-- Create unique index to enforce uniqueness for non-null usernames
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS staff_logins_username_idx ON public.staff_logins(username) WHERE username IS NOT NULL;
