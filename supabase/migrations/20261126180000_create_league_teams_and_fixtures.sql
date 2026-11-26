-- Migration: Create global league_teams directory and tenant-scoped official fixtures table

-- 1. Global League Teams (managed by Superadmin, readable by all tenants)
CREATE TABLE IF NOT EXISTS public.league_teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  short_name  text,
  league      text NOT NULL DEFAULT 'Ghana Premier League',
  season      text NOT NULL DEFAULT '2026/2027',
  logo_url    text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_league_teams_name ON public.league_teams (name);

ALTER TABLE public.league_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view league teams" ON public.league_teams;
CREATE POLICY "Authenticated users can view league teams"
  ON public.league_teams FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Superadmins can insert league teams" ON public.league_teams;
CREATE POLICY "Superadmins can insert league teams"
  ON public.league_teams FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

DROP POLICY IF EXISTS "Superadmins can update league teams" ON public.league_teams;
CREATE POLICY "Superadmins can update league teams"
  ON public.league_teams FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

DROP POLICY IF EXISTS "Superadmins can delete league teams" ON public.league_teams;
CREATE POLICY "Superadmins can delete league teams"
  ON public.league_teams FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
  );


-- 2. Tenant-Scoped Official Fixtures & Match Results
CREATE TABLE IF NOT EXISTS public.fixtures (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  opponent_team_id  uuid REFERENCES public.league_teams(id) ON DELETE SET NULL,
  opponent_name     text NOT NULL,
  opponent_logo_url text,
  competition       text NOT NULL DEFAULT 'Ghana Premier League',
  match_date        date NOT NULL,
  kickoff_time      text DEFAULT '15:00',
  venue             text,
  is_home           boolean NOT NULL DEFAULT true,
  home_score        integer,
  away_score        integer,
  status            text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'postponed')),
  notes             text,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fixtures_team_date ON public.fixtures (team_id, match_date DESC);

ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members can view team fixtures" ON public.fixtures;
CREATE POLICY "Team members can view team fixtures"
  ON public.fixtures FOR SELECT
  TO authenticated
  USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

DROP POLICY IF EXISTS "Analysts coaches and admins can insert fixtures" ON public.fixtures;
CREATE POLICY "Analysts coaches and admins can insert fixtures"
  ON public.fixtures FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('analyst', 'coach', 'admin', 'superadmin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

DROP POLICY IF EXISTS "Analysts coaches and admins can update fixtures" ON public.fixtures;
CREATE POLICY "Analysts coaches and admins can update fixtures"
  ON public.fixtures FOR UPDATE
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('analyst', 'coach', 'admin', 'superadmin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

DROP POLICY IF EXISTS "Analysts coaches and admins can delete fixtures" ON public.fixtures;
CREATE POLICY "Analysts coaches and admins can delete fixtures"
  ON public.fixtures FOR DELETE
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('analyst', 'coach', 'admin', 'superadmin')
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
  );


-- 3. Seed Ghana Premier League Teams & Uploaded Logos
INSERT INTO public.league_teams (name, short_name, league, season, logo_url, is_active)
VALUES
  ('Aduana FC',              'ADU', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/aduana.png', true),
  ('Asante Kotoko SC',       'KOT', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/asantekotoko.png', true),
  ('AshantiGold SC',         'ASH', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/ashgold.png', true),
  ('Basake Holy Stars FC',   'BHS', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/basakeholystars.png', true),
  ('Bechem United FC',       'BEC', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/bechemunited.png', true),
  ('Berekum Chelsea FC',     'BCH', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/chelsea.png', true),
  ('Debibi United FC',       'DEB', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/debibiunited.png', true),
  ('Dreams FC',              'DRM', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/dreamsfc.png', true),
  ('Bibiani Gold Stars FC',  'BGS', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/goldstarsfc.png', true),
  ('Heart of Lions FC',      'HOL', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/heartoflions.png', true),
  ('Accra Hearts of Oak SC', 'AHO', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/hearts.png', true),
  ('Karela United FC',       'KAR', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/karelaunited.png', true),
  ('Legon Cities FC',        'LEG', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/legon_cities.png', true),
  ('Medeama SC',             'MED', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/medeamasc.png', true),
  ('Nsoatreman FC',          'NSO', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/nsoatremanfc.png', true),
  ('Port City FC',           'PRT', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/portcity.png', true),
  ('FC Samartex 1996',       'SAM', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/samartex.png', true),
  ('Swedru All Blacks',      'SAB', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/swedruallblacks.png', true),
  ('Vision FC',              'VIS', 'Ghana Premier League', '2026/2027', 'https://nivgcxbobofxoszvijhp.supabase.co/storage/v1/object/public/athlete-photos/league-teams/vision.png', true)
ON CONFLICT (name) DO UPDATE
SET short_name = EXCLUDED.short_name,
    logo_url   = EXCLUDED.logo_url,
    is_active  = true,
    updated_at = now();
