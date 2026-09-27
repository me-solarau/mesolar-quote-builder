/**
 * Who can do what.
 *
 * Two tiers. Free members (and anonymous visitors) can read everything —
 * results, stats, decisions, AI verdicts and the discussion. Interacting costs
 * US$2.50 a year: posting, voting, uploading evidence and asking the AI.
 *
 * This is the one place those rules live. The UI asks `can()` before showing a
 * control, and the server must ask the same question before doing the work —
 * a hidden button is not a permission check.
 */

export const PRICE = { amount: 2.5, currency: 'USD', period: 'year', label: 'US$2.50 / year' }

export const ACTIONS = {
  view: 'anyone',
  post: 'supporter',
  reply: 'supporter',
  vote: 'supporter',
  upload: 'supporter',
  'ai-review': 'supporter',
  'ai-feedback': 'supporter',
  moderate: 'admin',
  ingest: 'admin'
}

export function isSupporter (user, now = Date.now()) {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.tier !== 'supporter' || !user.subscribedUntil) return false
  return new Date(user.subscribedUntil).getTime() > now
}

export function can (user, action, now = Date.now()) {
  const need = ACTIONS[action]
  if (!need) throw new Error(`Unknown action: ${action}`)
  if (need === 'anyone') return true
  if (need === 'admin') return user?.role === 'admin'
  return isSupporter(user, now)
}

/** Why an action is blocked, phrased for the person who was blocked. */
export function blockedReason (user, action, now = Date.now()) {
  if (can(user, action, now)) return null
  if (ACTIONS[action] === 'admin') return 'Only the RefLens desk can do this.'
  if (!user) return `Create a free account, then upgrade for ${PRICE.label} to join in.`
  if (user.tier === 'supporter') return `Your supporter membership has lapsed. Renew for ${PRICE.label}.`
  return `Free members can read everything. Upgrade for ${PRICE.label} to post, vote and upload evidence.`
}

/** Extend from the later of now or the current expiry, so early renewal never loses days. */
export function renewUntil (user, now = Date.now()) {
  const current = user?.subscribedUntil ? new Date(user.subscribedUntil).getTime() : 0
  const from = new Date(Math.max(now, current))
  from.setUTCFullYear(from.getUTCFullYear() + 1)
  return from.toISOString()
}
