import { createContext, useContext, useMemo, useSyncExternalStore, useState, useEffect } from 'react'

import { buildTelemetry, NOW_MS } from '../data/simulate.js'
import { BILLING_PERIODS, CURRENT_PERIOD_ID, ESTIMATE_SOURCE_BILL_ID } from '../data/seed.js'
import { SITE, TENANTS } from '../data/site.js'
import { allocate } from './allocation.js'
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

  const alerts = useMemo(
    () => buildAlerts({ allocation: allocations[CURRENT_PERIOD_ID], telemetry: t, site: SITE, nowMs: NOW_MS }),
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
    splitRule: rule,
    alerts,
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
