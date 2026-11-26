-- Migration: Extend profiles_role_check to include analyst and scout
-- Previously the constraint only allowed: superadmin, admin, coach, physio, player, accountant
-- This caused "Failed to create profile" errors when issuing analyst or scout logins
-- because the code tried to insert role='analyst' which the DB rejected (code 23514).
-- Now roles are stored directly and correctly without the coach workaround.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'superadmin',
    'admin',
    'coach',
    'physio',
    'player',
    'accountant',
    'analyst',
    'scout'
  ));

-- Verify
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'profiles_role_check';
