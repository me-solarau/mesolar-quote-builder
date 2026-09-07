/**
 * Application state.
 *
 * This build has no backend, so owner-entered records live in localStorage.
 * The shape is deliberately the shape a Postgres schema would have — device
 * assignments, split rules, retailer bills, issued statements, overrides and
 * an append-only audit trail — so the swap to a real API is a transport change,
 * not a redesign.
 *
 * One rule worth keeping when this does get a backend: an issued statement
 * stores a *snapshot* of the numbers at the moment it was issued. Changing a
 * split rule or a device assignment afterwards must never silently restate a
 * bill someone has already been asked to pay.
 */

import {
  RETAILER_BILLS,
  SPLIT_RULES,
  ACTIVE_SPLIT_RULE_ID,
  ISSUED_STATEMENTS,
  SEED_AUDIT
} from '../data/seed.js'

const KEY = 'powershare.state.v1'
const SESSION_KEY = 'powershare.session.v1'
const THEME_KEY = 'powershare.theme.v1'

const listeners = new Set()
let state = load()

function seedState () {
  return {
    version: 1,
    assignments: {},          // deviceId -> assignment (overrides the site model)
    splitRules: SPLIT_RULES,
    activeSplitRuleId: ACTIVE_SPLIT_RULE_ID,
    bills: RETAILER_BILLS,
    statements: ISSUED_STATEMENTS.map((s) => ({ ...s, snapshot: null })),
    overrides: [],            // {periodId, reason, byMs, by}
    addedDevices: [],         // meters onboarded in-app, awaiting first reading
    audit: SEED_AUDIT.map((e, i) => ({ id: `seed-${i}`, ...e }))
  }
}

function load () {
  if (typeof localStorage === 'undefined') return seedState()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seedState()
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1) return seedState()
    return { ...seedState(), ...parsed }
  } catch {
    return seedState()
  }
}

function persist () {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Private browsing or blocked storage — the app still works for this
    // session, changes just do not survive a reload.
  }
}

function emit () {
  for (const fn of listeners) fn()
}

export function subscribe (fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getState () {
  return state
}

function set (next) {
  state = { ...state, ...next }
  persist()
  emit()
}

/* ------------------------------------------------------------------ */
/* Audit trail (FR-12) — append only, never edited                     */
/* ------------------------------------------------------------------ */

export function logAudit (actor, action, summary, detail = '') {
  const entry = {
    id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tsMs: Date.now(),
    actor,
    action,
    summary,
    detail
  }
  set({ audit: [...state.audit, entry] })
  return entry
}

export function auditTrail () {
  return [...state.audit].sort((a, b) => b.tsMs - a.tsMs)
}

/* ------------------------------------------------------------------ */
/* Device assignment (FR-01)                                           */
/* ------------------------------------------------------------------ */

export function setAssignment (device, assignment, actor, label) {
  const before = state.assignments[device.id] ?? device.assignment
  if (before === assignment) return
  set({ assignments: { ...state.assignments, [device.id]: assignment } })
  logAudit(
    actor,
    'device.reassigned',
    `${device.name} reassigned to ${label}.`,
    `Previous assignment: ${before}. New assignment: ${assignment}. ` +
      'Applies to every period recalculated from this point, including open periods.'
  )
}

/**
 * Onboard a meter (FR-01).
 *
 * A newly added meter carries no history and contributes nothing to any
 * allocation until it reports — which is exactly how a real commissioning
 * works. It appears in the device list as "awaiting first reading" so the
 * installer can see it was accepted, and it is billed from the first period in
 * which it actually produces cumulative energy.
 */
export function addDevice (device, actor) {
  const record = {
    ...device,
    id: device.id || `dev-${Date.now().toString(36)}`,
    addedAtMs: Date.now(),
    pending: true
  }
  set({ addedDevices: [...state.addedDevices, record] })
  logAudit(actor, 'device.onboarded',
    `Onboarded ${record.name} at ${record.ip}.`,
    `${record.model} · ${record.loadType} · assigned to ${record.assignment}. ` +
      'No cumulative energy recorded yet; the endpoint contributes nothing to ' +
      'an allocation until it reports.')
  return record
}

export function removeDevice (id, actor) {
  const dv = state.addedDevices.find((d) => d.id === id)
  if (!dv) return
  set({ addedDevices: state.addedDevices.filter((d) => d.id !== id) })
  logAudit(actor, 'device.removed', `Removed ${dv.name} before it reported.`,
    'The endpoint had no energy history, so no allocation is affected.')
}

/* ------------------------------------------------------------------ */
/* Communal split rules (FR-09)                                        */
/* ------------------------------------------------------------------ */

export function activeSplitRule () {
  return state.splitRules.find((r) => r.id === state.activeSplitRuleId) ?? state.splitRules[0]
}

export function setActiveSplitRule (id, actor) {
  const rule = state.splitRules.find((r) => r.id === id)
  if (!rule || id === state.activeSplitRuleId) return
  set({ activeSplitRuleId: id })
  logAudit(actor, 'split_rule.set', `Communal split rule changed to “${rule.name}”.`,
    'Open periods are recalculated immediately. Statements already issued keep ' +
    'the split they were issued under.')
}

export function saveSplitRule (rule, actor) {
  const exists = state.splitRules.some((r) => r.id === rule.id)
  const rules = exists
    ? state.splitRules.map((r) => (r.id === rule.id ? rule : r))
    : [...state.splitRules, rule]
  set({ splitRules: rules })
  logAudit(actor, 'split_rule.updated', `Split rule “${rule.name}” saved.`,
    Object.entries(rule.weights ?? {}).map(([k, v]) => `${k}: ${v}`).join(', '))
}

/* ------------------------------------------------------------------ */
/* Retailer bills (FR-07)                                              */
/* ------------------------------------------------------------------ */

export function billFor (periodId) {
  return state.bills.find((b) => b.periodId === periodId) ?? null
}

export function saveBill (bill, actor) {
  const exists = state.bills.some((b) => b.id === bill.id)
  const bills = exists
    ? state.bills.map((b) => (b.id === bill.id ? { ...b, ...bill } : b))
    : [...state.bills, bill]
  set({ bills })
  logAudit(
    actor,
    exists ? 'bill.updated' : 'bill.entered',
    `${exists ? 'Updated' : 'Entered'} retailer bill ${bill.invoiceNo || bill.id}.`,
    `${Number(bill.totalKwh).toLocaleString('en-AU')} kWh · invoice total ` +
      `$${Number(bill.retailerTotal).toFixed(2)} · distributable ` +
      `$${Number(bill.distributableAmount).toFixed(2)}.`
  )
}

/* ------------------------------------------------------------------ */
/* Statements (FR-10) and integrity overrides                          */
/* ------------------------------------------------------------------ */

export function statementFor (periodId) {
  return state.statements.find((s) => s.periodId === periodId) ?? null
}

export function issueStatement (periodId, snapshot, actor, note = '') {
  const record = {
    periodId,
    issuedAtMs: Date.now(),
    issuedBy: actor,
    snapshot,
    note
  }
  const statements = state.statements.some((s) => s.periodId === periodId)
    ? state.statements.map((s) => (s.periodId === periodId ? record : s))
    : [...state.statements, record]
  set({ statements })
  logAudit(actor, 'statement.issued', `Issued statements for ${snapshot.periodLabel}.`,
    `Master ${snapshot.masterKwh.toFixed(1)} kWh · distributable ` +
    `$${snapshot.distributable.toFixed(2)} · ${snapshot.rows.length} participants. ` +
    (note ? `Note: ${note}` : 'Figures frozen at issue.'))
  return record
}

/**
 * Seeded statements ship without a snapshot because the figures depend on
 * telemetry that only exists once the app is running. Backfilling on first
 * load means the immutability guarantee — an issued statement never restates
 * itself — holds for the historical statements too, not just new ones.
 */
export function backfillSnapshot (periodId, snapshot) {
  const existing = state.statements.find((s) => s.periodId === periodId)
  if (!existing || existing.snapshot) return false
  set({
    statements: state.statements.map((s) =>
      s.periodId === periodId ? { ...s, snapshot, backfilled: true } : s
    )
  })
  return true
}

export function overrideFor (periodId) {
  return state.overrides.find((o) => o.periodId === periodId) ?? null
}

export function recordOverride (periodId, reason, actor, atRiskKwh, periodLabel = periodId) {
  const entry = { periodId, reason, byMs: Date.now(), by: actor }
  set({ overrides: [...state.overrides.filter((o) => o.periodId !== periodId), entry] })
  logAudit(actor, 'reconciliation.override',
    `Data-integrity block overridden for ${periodLabel}.`,
    `${atRiskKwh.toFixed(1)} kWh of unattributed energy accepted. Reason: ${reason}`)
  return entry
}

export function clearOverride (periodId, actor, periodLabel = periodId) {
  if (!overrideFor(periodId)) return
  set({ overrides: state.overrides.filter((o) => o.periodId !== periodId) })
  logAudit(actor, 'reconciliation.override_cleared',
    `Data-integrity override withdrawn for ${periodLabel}.`,
    'The period is blocked again until the unattributed energy is resolved.')
}

/* ------------------------------------------------------------------ */
/* Session and theme                                                   */
/* ------------------------------------------------------------------ */

/**
 * The session snapshot must be a stable reference: useSyncExternalStore calls
 * the getter on every render and re-renders whenever the value changes by
 * identity, so parsing JSON afresh each time would loop forever.
 */
let sessionCache
let sessionLoaded = false

export function getSession () {
  if (!sessionLoaded) {
    sessionLoaded = true
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      sessionCache = raw ? JSON.parse(raw) : null
    } catch {
      sessionCache = null
    }
  }
  return sessionCache
}

export function setSession (account) {
  sessionCache = account ?? null
  sessionLoaded = true
  try {
    if (account) localStorage.setItem(SESSION_KEY, JSON.stringify(account))
    else localStorage.removeItem(SESSION_KEY)
  } catch { /* storage blocked — session is in-memory only */ }
  emit()
}

export function getTheme () {
  try {
    return localStorage.getItem(THEME_KEY) || 'system'
  } catch {
    return 'system'
  }
}

export function setTheme (theme) {
  try { localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
  applyTheme(theme)
  emit()
}

export function applyTheme (theme = getTheme()) {
  const el = document.documentElement
  if (theme === 'system') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', theme)
}

/* ------------------------------------------------------------------ */

export function resetDemoData () {
  try {
    localStorage.removeItem(KEY)
  } catch { /* ignore */ }
  state = seedState()
  emit()
}
