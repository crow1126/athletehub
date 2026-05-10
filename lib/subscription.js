// lib/subscription.js
// Fetches current subscription and exposes helpers to enforce plan limits

import { supabase } from './supabase'

export const PLAN_LIMITS = {
  trial: {
    label:          'Free Trial',
    athlete_limit:  999,
    staff_limit:    99,
    modules:        ['dashboard','athletes','coaches','schedule','injuries','performance','scouting','contracts','reports','settings','billing'],
    description:    'Full access for 30 days',
  },
  starter: {
    label:          'Starter — GHS 350/mo',
    athlete_limit:  40,
    staff_limit:    3,
    modules:        ['dashboard','athletes','schedule','settings','billing'],
    description:    '40 athletes · 3 staff · Scheduling only',
  },
  academy: {
    label:          'Academy — GHS 600/mo',
    athlete_limit:  100,
    staff_limit:    10,
    modules:        ['dashboard','athletes','coaches','schedule','injuries','performance','scouting','reports','settings','billing','transfers'],
    description:    '100 athletes · 10 staff · Full medical, analytics, scouting & transfers',
  },
  elite: {
    label:          'Elite — GHS 1,000/mo',
    athlete_limit:  9999,
    staff_limit:    999,
    modules:        ['dashboard','athletes','coaches','schedule','injuries','performance','scouting','contracts','reports','settings','billing','transfers'],
    description:    'Unlimited athletes & staff · All modules including contracts & transfers',
  },
}

export async function getSubscription(team_id) {
  if (!team_id) return null
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('team_id', team_id)
    .single()
  return data
}

export function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.trial
}

export function canAccessModule(plan, module) {
  const limits = getPlanLimits(plan)
  return limits.modules.includes(module)
}

export function isAtAthleteLimit(plan, currentCount) {
  const limits = getPlanLimits(plan)
  return currentCount >= limits.athlete_limit
}

export function isAtStaffLimit(plan, currentCount) {
  const limits = getPlanLimits(plan)
  return currentCount >= limits.staff_limit
}

export function getUpgradeMessage(plan, type) {
  const messages = {
    starter: {
      athletes: `Your Starter plan allows up to 40 athlete profiles. Upgrade to Academy (GHS 600/mo) for up to 100, or Elite for unlimited.`,
      staff:    `Your Starter plan allows up to 3 staff accounts. Upgrade to Academy (GHS 600/mo) for up to 10.`,
      module:   `This module is not available on the Starter plan. Upgrade to Academy or Elite to unlock it.`,
    },
    academy: {
      athletes: `Your Academy plan allows up to 100 athlete profiles. Upgrade to Elite (GHS 1,000/mo) for unlimited.`,
      staff:    `Your Academy plan allows up to 10 staff accounts. Upgrade to Elite (GHS 1,000/mo) for unlimited.`,
      module:   `This module requires the Elite plan. Upgrade to unlock contracts and all features.`,
    },
    trial: {
      athletes: `Trial ending soon. Subscribe to keep managing your athletes.`,
      staff:    `Trial ending soon. Subscribe to keep your staff accounts.`,
      module:   `Subscribe to continue accessing all modules after your trial ends.`,
    },
  }
  return messages[plan]?.[type] || 'Upgrade your plan to access this feature.'
}