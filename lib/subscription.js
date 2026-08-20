// lib/subscription.js
// Fetches current subscription and exposes helpers to enforce plan limits

import { supabase } from './supabase'

export const PLAN_LIMITS = {
  superadmin: {
    label:          'Superadmin Platform (Unlimited)',
    athlete_limit:  999999,
    staff_limit:    99999,
    modules:        ['superadmin','dashboard','athletes','coaches','schedule','injuries','performance','scouting','contracts','reports','settings','billing','transfers','player-hub','pay'],
    description:    'Unlimited lifetime superadmin platform access',
  },
  trial: {
    label:          'Free Trial',
    athlete_limit:  999,
    staff_limit:    99,
    modules:        ['dashboard','athletes','coaches','schedule','injuries','performance','scouting','contracts','reports','settings','billing','transfers','player-hub'],
    description:    'Full access for 30 days',
  },
  starting_xi: {
    label:          'Starting XI — GHS 199/mo',
    athlete_limit:  40,
    staff_limit:    99,
    modules:        ['dashboard','athletes','coaches','schedule','injuries','reports','settings','billing','player-hub'],
    description:    'Up to 40 athletes · Squad Roster · Training Scheduler · Injury Hub · Basic Reports · Admin/Coach/Physio roles',
  },
  captain: {
    label:          'Captain — GHS 499/mo',
    athlete_limit:  9999,
    staff_limit:    999,
    modules:        ['dashboard','athletes','coaches','schedule','injuries','performance','scouting','contracts','reports','settings','billing','transfers','player-hub'],
    description:    'Unlimited athletes · All modules including Performance Analytics, Scouting & Transfers',
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
  if (plan === 'superadmin') return PLAN_LIMITS.superadmin
  let mappedPlan = plan
  if (plan === 'starter') mappedPlan = 'starting_xi'
  if (plan === 'academy' || plan === 'elite') mappedPlan = 'captain'
  return PLAN_LIMITS[mappedPlan] || PLAN_LIMITS.trial
}

export function canAccessModule(plan, module) {
  if (plan === 'superadmin') return true
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
    starting_xi: {
      athletes: `Your Starting XI plan allows up to 40 athlete profiles. Upgrade to Captain (GHS 499/mo) for unlimited athletes.`,
      staff:    `Your plan does not allow this role. Upgrade to Captain (GHS 499/mo) to unlock all roles.`,
      module:   `This module is not available on the Starting XI plan. Upgrade to Captain to unlock it.`,
    },
    captain: {
      athletes: `Your Captain plan allows unlimited athlete profiles.`,
      staff:    `Your Captain plan allows unlimited staff accounts.`,
      module:   `All modules are unlocked on the Captain plan.`,
    },
    trial: {
      athletes: `Trial ending soon. Subscribe to keep managing your athletes.`,
      staff:    `Trial ending soon. Subscribe to keep your staff accounts.`,
      module:   `Subscribe to continue accessing all modules after your trial ends.`,
    },
  }
  let mappedPlan = plan
  if (plan === 'starter') mappedPlan = 'starting_xi'
  if (plan === 'academy' || plan === 'elite') mappedPlan = 'captain'
  return messages[mappedPlan]?.[type] || 'Upgrade your plan to access this feature.'
}