-- Migration: 20260628190000_add_notified_to_performance_stats.sql
-- Adds a boolean flag to track whether a performance stat entry has been
-- included in a published team notification. Allows silent saving of individual
-- entries while the analyst completes the batch, then a single "Publish & Notify"
-- action sends one team-wide notification for all unnotified entries.

begin;

ALTER TABLE public.performance_stats
  ADD COLUMN IF NOT EXISTS notified boolean NOT NULL DEFAULT false;

-- Index for efficiently querying unnotified entries per team
CREATE INDEX IF NOT EXISTS idx_performance_stats_team_notified
  ON public.performance_stats(team_id, notified)
  WHERE notified = false;

commit;
