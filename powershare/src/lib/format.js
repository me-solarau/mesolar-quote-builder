/** Formatting helpers. Australian conventions throughout. */

const AEST_TZ = 'Australia/Sydney'

export const kwh = (n, dp = 0) =>
  (n ?? 0).toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })

export const kw = (n, dp = 2) =>
  n == null ? '—' : n.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })

export const money = (n) =>
  (n ?? 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })

export const pct = (n, dp = 1) =>
  `${((n ?? 0) * 100).toFixed(dp)}%`

export const signedPct = (n, dp = 1) => {
  const v = (n ?? 0) * 100
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(dp)}%`
}

const dtf = (opts) => new Intl.DateTimeFormat('en-AU', { timeZone: AEST_TZ, ...opts })

export const date = (ms) => dtf({ day: 'numeric', month: 'short', year: 'numeric' }).format(ms)
export const dateShort = (ms) => dtf({ day: 'numeric', month: 'short' }).format(ms)
export const dayMonth = (ms) => dtf({ day: '2-digit', month: 'short' }).format(ms)
export const time = (ms) => dtf({ hour: '2-digit', minute: '2-digit', hour12: false }).format(ms)
export const dateTime = (ms) =>
  `${dtf({ day: 'numeric', month: 'short' }).format(ms)}, ${time(ms)}`
export const fullDateTime = (ms) =>
  `${date(ms)} ${time(ms)}`

/** "3 days ago", "6 hours ago" — for last-seen and audit rows. */
export function ago (ms, nowMs) {
  const s = Math.max(0, (nowMs - ms) / 1000)
  if (s < 90) return 'just now'
  const m = s / 60
  if (m < 90) return `${Math.round(m)} min ago`
  const h = m / 60
  if (h < 36) return `${Math.round(h)} hr ago`
  return `${Math.round(h / 24)} days ago`
}

export function duration (hours) {
  if (hours < 24) return `${Math.round(hours)} h`
  const d = Math.floor(hours / 24)
  const h = Math.round(hours % 24)
  return h ? `${d} d ${h} h` : `${d} d`
}

export const initials = (name) =>
  name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
