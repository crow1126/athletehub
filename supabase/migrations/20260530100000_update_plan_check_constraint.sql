-- Drop the old plan check constraint and add new one with updated plan names
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('trial', 'starting_xi', 'captain'));

