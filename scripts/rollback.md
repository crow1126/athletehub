# Blue-Green Deployment & Rollback Guide

## Overview

ApexTrack runs on **Vercel + Supabase**. Vercel's deployment model is inherently blue-green:
every git push creates an **immutable, isolated deployment** before production is switched over.

---

## How It Works

```
Feature branch → PR → Preview Deployment (isolated URL)
                              ↓  (review / QA)
Merge to main → Production Deployment (atomic promotion)
```

Vercel deploys the new build in parallel alongside the current production. Traffic only
switches when the new build is healthy. If the build fails, production is never touched.

---

## Rollback a Vercel Deployment (< 30 seconds)

### Option 1 — Vercel Dashboard (recommended)
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select the **ghana-football-app** project
3. Click **Deployments** tab
4. Find the last known-good deployment
5. Click **⋯ → Promote to Production**

### Option 2 — Vercel CLI
```bash
# Install the CLI if needed
npm i -g vercel

# List recent deployments
vercel ls

# Rollback to the previous deployment
vercel rollback

# Or promote a specific deployment URL to production
vercel promote <deployment-url>
```

### Option 3 — Git revert (for code-level rollback)
```bash
git revert HEAD --no-edit
git push origin main
```
This creates a new commit that undoes the last change and triggers a fresh CI/CD run.

---

## Database Migration Rollbacks

> ⚠️ Supabase migrations are forward-only by default.
> Always test migrations on a **staging** project before running on production.

### Safe rollback pattern
Every migration in `supabase/migrations/` should have a corresponding `-- DOWN:` comment
documenting what to run to undo it. For example:

```sql
-- UP:
create index if not exists idx_athletes_team_id on public.athletes(team_id);

-- DOWN (if needed, run manually in Supabase SQL editor):
-- drop index if exists idx_athletes_team_id;
```

### Emergency DB rollback
1. Open the **Supabase Dashboard → Database → Backups**
2. Use **Point-in-Time Recovery** (Pro plan) to restore to a timestamp before the bad migration
3. Re-apply only the migrations that should remain

---

## Supabase Point-in-Time Recovery (PITR)

PITR is available on the **Supabase Pro plan**.

**Enable it:**
1. Go to Supabase Dashboard → Settings → Database
2. Enable "Point-in-Time Recovery"
3. Set retention period (minimum 7 days recommended)

**Use it for rollback:**
```bash
# Via Supabase Management API
curl -X POST 'https://api.supabase.com/v1/projects/{ref}/database/backups/restore' \
  -H 'Authorization: Bearer {token}' \
  -d '{ "recovery_time_target_unix": 1720000000 }'
```

---

## Backup Schedule

| Type | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| Supabase Daily Backup | Automatic | 7 days (Free) / 30 days (Pro) | Supabase Dashboard |
| PITR | Continuous | 7–28 days | Supabase Pro |
| Manual Export | Weekly (via cron or manual) | Keep last 4 | `pg_dump` or Supabase CSV export |

---

## Production Deployment Checklist

Before promoting to production:
- [ ] All CI checks pass (lint, type-check, build, tests)
- [ ] Tested on preview URL
- [ ] Any new DB migrations reviewed and tested on staging
- [ ] `.env` variables added to Vercel project settings
- [ ] Moolre webhook URLs point to production domain (not localhost)
- [ ] `NEXT_PUBLIC_ENABLE_SIMULATION` is `false` or unset

---

## Emergency Contacts

- Vercel Status: https://www.vercel-status.com
- Supabase Status: https://status.supabase.com
- Moolre API: https://moolre.com
