import { createContext, useContext, useMemo, useSyncExternalStore, useState, useEffect } from 'react'

import { buildTelemetry, NOW_MS } from '../data/simulate.js'
import { BILLING_PERIODS, CURRENT_PERIOD_ID, ESTIMATE_SOURCE_BILL_ID } from '../data/seed.js'
import { SITE, TENANTS } from '../data/site.js'
import { allocate } from './allocation.js'
import { buildSnapshot } from './statement.js'
import { rangeFor } from '../components/RangePicker.jsx'
import { buildAlerts } from './alerts.js'
import * as store from './store.js'

const Ctx = createContext(null)

/** Telemetry is deterministic, so it is built once for the whole session. */
let telemetryCache = null
function telemetry () {
  if (!telemetryCache) telemetryCache = buildTelemetry()
  return telemetryCache
}

export function AppProvider ({ children }) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)
  const session = useSyncExternalStore(store.subscribe, store.getSession, () => null)
  const [periodId, setPeriodId] = useState(CURRENT_PERIOD_ID)
  // Usage views can be re-scoped to Today / 7 days / a custom window.
  // Billing never is — a statement always covers exactly one billing period.
  const [rangeMode, setRangeMode] = useState('period')
  const [customRange, setCustomRange] = useState(() => ({
    startMs: NOW_MS - 13 * 86400_000,
    endMs: NOW_MS
  }))

  useEffect(() => { store.applyTheme() }, [])

  const t = telemetry()
  const rule = state.splitRules.find((r) => r.id === state.activeSplitRuleId) ?? state.splitRules[0]

  /** Every period allocated — history charts need all of them anyway. */
  const allocations = useMemo(() => {
    const out = {}
    for (const p of BILLING_PERIODS) {
      out[p.id] = allocate({
        telemetry: t,
        period: p,
        splitRule: rule,
        assignments: state.assignments,
        bill: state.bills.find((b) => b.periodId === p.id) ?? null,
        site: SITE
      })
    }
    return out
  }, [t, rule, state.assignments, state.bills])

  const period = BILLING_PERIODS.find((p) => p.id === periodId) ?? BILLING_PERIODS.at(-1)
  const allocation = allocations[period.id]

  const range = rangeFor(rangeMode, period, NOW_MS, customRange)

  /**
   * The same engine, run over an arbitrary window. Only the usage views read
   * this — everything to do with money reads `allocation` above.
   */
  const rangeAllocation = useMemo(
    () => allocate({
      telemetry: t,
      period: { id: 'range', label: range.label, startMs: range.startMs, endMs: range.endMs },
      splitRule: rule,
      assignments: state.assignments,
      bill: null,
      site: SITE
    }),
    [t, rule, state.assignments, range.startMs, range.endMs, range.label]
  )

  // Alerts describe the period on screen. Pinning them to the open period
  // would put live warnings beside closed-period figures they do not apply to.
  const alerts = useMemo(
    () => buildAlerts({ allocation, telemetry: t, site: SITE, nowMs: NOW_MS }),
    [allocation, t]
  )

  /** The open period's alerts, for the nav badge — always current. */
  const liveAlerts = useMemo(
    () => buildAlerts({
      allocation: allocations[CURRENT_PERIOD_ID], telemetry: t, site: SITE, nowMs: NOW_MS
    }),
    [allocations, t]
  )

  /**
   * Indicative rate for open periods, taken from the most recent issued bill
   * rather than invented. Anything priced with it is labelled "estimated".
   */
  const estimateRate = useMemo(() => {
    const bill = state.bills.find((b) => b.id === ESTIMATE_SOURCE_BILL_ID)
    if (!bill) return 0
    const a = allocations[bill.periodId]
    return a && a.reconciliation.masterKwh > 0
      ? bill.distributableAmount / a.reconciliation.masterKwh
      : 0
  }, [state.bills, allocations])

  /**
   * Freeze the seeded statements on first load, so every issued statement in
   * the app — historical or not — is backed by a stored snapshot rather than
   * recomputed on the fly.
   */
  useEffect(() => {
    for (const st of state.statements) {
      if (st.snapshot) continue
      const a = allocations[st.periodId]
      const bill = state.bills.find((b) => b.periodId === st.periodId)
      const p = BILLING_PERIODS.find((x) => x.id === st.periodId)
      if (!a || !bill || !p) continue
      store.backfillSnapshot(st.periodId, buildSnapshot({
        period: p,
        allocation: a,
        splitRule: rule,
        bill,
        override: state.overrides.find((o) => o.periodId === st.periodId) ?? null
      }))
    }
    // Runs once per statement: backfillSnapshot is a no-op once one exists.
  }, [state.statements, state.bills, state.overrides, allocations, rule])

  const value = {
    telemetry: t,
    nowMs: NOW_MS,
    site: SITE,
    tenants: TENANTS,
    periods: BILLING_PERIODS,
    currentPeriodId: CURRENT_PERIOD_ID,
    period,
    periodId: period.id,
    setPeriodId,
    allocation,
    allocations,
    range,
    rangeMode,
    setRangeMode,
    customRange,
    setCustomRange,
    rangeAllocation,
    earliestMs: t.hours[0],
    splitRule: rule,
    alerts,
    liveAlerts,
    estimateRate,
    state,
    session,
    store
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp () {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside <AppProvider>')
  return v
}

/** Minimal hash router — no dependency, and deep links still work. */
export function useRoute () {
  const get = () => window.location.hash.replace(/^#\/?/, '') || ''
  const [route, setRoute] = useState(get)
  useEffect(() => {
    const on = () => setRoute(get())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const navigate = (to) => { window.location.hash = `/${to}` }
  return [route, navigate]
}
