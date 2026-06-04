-- Migration to add athlete_id to profiles, linking user accounts to athletes.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS athlete_id uuid REFERENCES public.athletes(id) ON DELETE SET NULL;

-- Enforce that an athlete can only have one login profile
CREATE UNIQUE INDEX IF NOT EXISTS profiles_athlete_id_idx ON public.profiles(athlete_id) WHERE athlete_id IS NOT NULL;

-- Update protect_profile_security_fields to preserve athlete_id
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_superadmin() THEN
    RETURN new;
  END IF;

  IF old.id = auth.uid() THEN
    new.id := old.id;
    new.email := old.email;
    new.role := old.role;
    new.team_id := old.team_id;
    new.athlete_id := old.athlete_id;
    new.is_active := old.is_active;
    new.registration_status := old.registration_status;
    new.approved_at := old.approved_at;
    new.rejection_reason := old.rejection_reason;
    RETURN new;
  END IF;

  IF public.is_team_admin()
    AND old.team_id = public.get_my_team_id()
    AND old.role <> 'superadmin'
    AND new.role <> 'superadmin' THEN
    new.id := old.id;
    new.email := old.email;
    new.team_id := old.team_id;
    new.athlete_id := old.athlete_id;
    RETURN new;
  END IF;

  RAISE EXCEPTION 'not allowed to update this profile';
END;
$$;
