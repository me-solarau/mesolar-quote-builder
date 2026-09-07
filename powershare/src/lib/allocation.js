/**
 * Allocation engine.
 *
 * Implements the PRD's base calculation sequence (section 5) exactly:
 *
 *   1. Read master 3-phase kWh for the exact bill period.
 *   2. Read each explicit tenant and communal meter delta for the same period.
 *   3. Main Tenant Direct kWh = master - every explicitly assigned endpoint.
 *   4. Communal kWh = the sum of its assigned endpoints.
 *   5. Split communal kWh using the configured weights (base: 25% each).
 *   6. Allocated Tenant kWh = Direct kWh + Communal Share kWh.
 *   7. Allocated Cost = Allocated kWh / Master kWh x Distributable Bill Amount.
 *   8. Check the allocation reconciles back to the retailer totals.
 *
 * Everything here is pure: given the same telemetry, period and rules it
 * returns the same numbers. That is what makes a statement defensible.
 */

import { DEVICES, MASTER_ID, TENANTS } from '../data/site.js'
import { hourIndex } from '../data/simulate.js'

const HOUR = 3600_000

/* ------------------------------------------------------------------ */
/* Per-device deltas, with reset correction and coverage               */
/* ------------------------------------------------------------------ */

/**
 * Energy consumed by one device between two hour indices.
 *
 * Cumulative counters can go backwards — a firmware update or a power cycle
 * resets them to zero. The raw end-minus-start delta is then negative and
 * useless. We walk the series instead and treat a backwards step as a reset,
 * counting the post-reset reading as energy accrued since the reset. Every
 * such correction is returned so it can be shown and audited, never hidden.
 */
export function deviceDelta (series, i0, i1) {
  const { cum, ok } = series
  let corrected = 0
  const corrections = []
  let gapHours = 0
  let okHours = 0

  for (let i = i0; i < i1; i++) {
    const step = cum[i + 1] - cum[i]
    if (step < 0) {
      // Counter reset: the new reading is the energy since the reset.
      corrected += Math.max(0, cum[i + 1])
      corrections.push({
        atIndex: i + 1,
        type: 'reset',
        lostRawKwh: round3(-step),
        appliedKwh: round3(Math.max(0, cum[i + 1]))
      })
    } else {
      corrected += step
    }
    if (ok[i + 1]) okHours++
    else gapHours++
  }

  const span = Math.max(1, i1 - i0)
  return {
    rawKwh: cum[i1] - cum[i0],
    kwh: corrected,
    corrections,
    gapHours,
    coverage: okHours / span,
    openingRead: cum[i0],
    closingRead: cum[i1]
  }
}

/**
 * Energy that flowed through the master during a device's reporting gap but
 * was never attributed to it. Estimated from the device's own recent history.
 *
 * A gap the meter rode out locally (its cumulative counter is higher on the far
 * side) costs nothing — the energy still lands in the delta. A gap where the
 * counter froze is the dangerous one: that energy silently falls into the main
 * tenant's residual.
 */
export function energyAtRisk (series, i0, i1) {
  const { cum, ok } = series
  let frozenHours = 0
  for (let i = i0 + 1; i <= i1; i++) {
    if (!ok[i] && cum[i] <= cum[i - 1] + 1e-9) frozenHours++
  }
  if (!frozenHours) return { frozenHours: 0, kwh: 0 }

  // Mean hourly consumption over the last week of healthy data before the gap.
  const lookback = Math.min(24 * 7, i1 - i0)
  let sum = 0
  let n = 0
  for (let i = Math.max(1, i1 - lookback); i <= i1; i++) {
    if (ok[i] && cum[i] >= cum[i - 1]) {
      sum += cum[i] - cum[i - 1]
      n++
    }
  }
  const meanPerHour = n ? sum / n : 0
  return { frozenHours, kwh: meanPerHour * frozenHours }
}

/* ------------------------------------------------------------------ */
/* Split rules                                                          */
/* ------------------------------------------------------------------ */

/** Normalised 0..1 share per participant. Equal mode ignores stored weights. */
export function splitShares (rule, participants) {
  if (!rule || rule.mode === 'equal') {
    const each = 1 / participants.length
    return Object.fromEntries(participants.map((id) => [id, each]))
  }
  const total = participants.reduce((a, id) => a + (Number(rule.weights?.[id]) || 0), 0)
  if (total <= 0) {
    const each = 1 / participants.length
    return Object.fromEntries(participants.map((id) => [id, each]))
  }
  return Object.fromEntries(
    participants.map((id) => [id, (Number(rule.weights?.[id]) || 0) / total])
  )
}

/* ------------------------------------------------------------------ */
/* The main calculation                                                 */
/* ------------------------------------------------------------------ */

/**
 * @param {object} o
 * @param {object} o.telemetry   from buildTelemetry()
 * @param {{startMs:number, endMs:number}} o.period
 * @param {object} o.splitRule
 * @param {Record<string,string>} [o.assignments] device id -> assignment override
 * @param {object} [o.bill] {totalKwh, distributableAmount, retailerTotal}
 * @param {object} [o.site] thresholds
 */
export function allocate ({ telemetry, period, splitRule, assignments = {}, bill = null, site }) {
  const { hours, series } = telemetry
  const i0 = hourIndex(hours, period.startMs)
  const i1 = hourIndex(hours, period.endMs)

  const assignmentOf = (dv) => assignments[dv.id] ?? dv.assignment
  const participants = TENANTS.map((t) => t.id)

  // --- Step 1: master ---
  const masterDelta = deviceDelta(series[MASTER_ID], i0, i1)
  const masterKwh = masterDelta.kwh

  // --- Step 2: every explicit endpoint ---
  const deviceRows = []
  let privateTotal = 0
  let communalKwh = 0
  let atRiskKwh = 0
  const privateByTenant = Object.fromEntries(participants.map((id) => [id, 0]))

  for (const dv of DEVICES) {
    if (dv.id === MASTER_ID) continue
    const assignment = assignmentOf(dv)
    const delta = deviceDelta(series[dv.id], i0, i1)
    const risk = energyAtRisk(series[dv.id], i0, i1)
    atRiskKwh += risk.kwh

    const row = {
      deviceId: dv.id,
      name: dv.name,
      area: dv.area,
      loadType: dv.loadType,
      assignment,
      ...delta,
      atRiskKwh: risk.kwh,
      frozenHours: risk.frozenHours
    }
    deviceRows.push(row)

    if (assignment.startsWith('tenant:')) {
      const tid = assignment.slice(7)
      if (tid in privateByTenant) privateByTenant[tid] += delta.kwh
      privateTotal += delta.kwh
    } else if (assignment === 'communal') {
      communalKwh += delta.kwh
    }
  }

  // --- Step 3: the main tenant's residual ---
  const meteredKwh = privateTotal + communalKwh
  const rawResidual = masterKwh - meteredKwh
  // A negative residual is physically impossible and means an endpoint is
  // double-counted or the master read is wrong. Clamp, but surface it.
  const mainDirectKwh = Math.max(0, rawResidual)

  // The residual holder's own private meters (if any were ever added) are
  // already inside privateByTenant; the residual is added on top of them.
  const residualTenant = TENANTS.find((t) => t.isResidual)
  const directByTenant = { ...privateByTenant }
  if (residualTenant) directByTenant[residualTenant.id] += mainDirectKwh

  // --- Steps 4 & 5: communal split ---
  const shares = splitShares(splitRule, participants)

  // --- Steps 6 & 7 ---
  const distributable = bill ? Number(bill.distributableAmount) || 0 : 0
  const perTenant = {}
  let allocatedTotal = 0
  let costTotal = 0

  for (const id of participants) {
    const directKwh = directByTenant[id]
    const communalShareKwh = communalKwh * shares[id]
    const allocatedKwh = directKwh + communalShareKwh
    const sharePct = masterKwh > 0 ? allocatedKwh / masterKwh : 0
    const cost = masterKwh > 0 ? (allocatedKwh / masterKwh) * distributable : 0
    perTenant[id] = {
      tenantId: id,
      directKwh,
      privateMeteredKwh: privateByTenant[id],
      residualKwh: id === residualTenant?.id ? mainDirectKwh : 0,
      communalShareKwh,
      communalSharePct: shares[id],
      allocatedKwh,
      sharePct,
      cost
    }
    allocatedTotal += allocatedKwh
    costTotal += cost
  }

  // --- Step 8: reconcile ---
  const residualPct = masterKwh > 0 ? mainDirectKwh / masterKwh : 0
  const atRiskPct = masterKwh > 0 ? atRiskKwh / masterKwh : 0
  const kwhReconciliationError = masterKwh > 0 ? (allocatedTotal - masterKwh) / masterKwh : 0
  const billKwhVariance =
    bill && Number(bill.totalKwh) > 0 ? (masterKwh - Number(bill.totalKwh)) / Number(bill.totalKwh) : null

  const thresholds = site ?? {}
  const reconciliation = {
    masterKwh,
    meteredKwh,
    privateKwh: privateTotal,
    communalKwh,
    residualKwh: mainDirectKwh,
    residualPct,
    rawResidualKwh: rawResidual,
    residualWithinBand:
      residualPct >= (thresholds.residualExpectedMin ?? 0) &&
      residualPct <= (thresholds.residualExpectedMax ?? 1),
    allocatedTotalKwh: allocatedTotal,
    kwhReconciliationError,
    atRiskKwh,
    atRiskPct,
    // MVP acceptance: materially incomplete data blocks statement issue unless
    // the owner overrides with a recorded reason.
    integrityBlocked: atRiskPct > (thresholds.integrityThreshold ?? 0.02),
    billKwhVariance,
    costTotal,
    distributable
  }

  return {
    period,
    i0,
    i1,
    hours: (i1 - i0),
    masterDelta,
    devices: deviceRows,
    communalKwh,
    privateByTenant,
    mainDirectKwh,
    splitShares: shares,
    perTenant,
    reconciliation
  }
}

/* ------------------------------------------------------------------ */
/* Series helpers for the charts                                        */
/* ------------------------------------------------------------------ */

/** Daily kWh for one device (or the master) across a period. */
export function dailySeries (telemetry, deviceId, i0, i1) {
  const { hours, series } = telemetry
  const s = series[deviceId]
  const out = []
  for (let i = i0; i < i1; i += 24) {
    const j = Math.min(i1, i + 24)
    const { kwh } = deviceDelta(s, i, j)
    out.push({ t: hours[i], kwh })
  }
  return out
}

/** Daily kWh summed over a set of devices, plus an optional residual line. */
export function dailyStacked (telemetry, groups, i0, i1, stepHours = 24) {
  const { hours } = telemetry
  const days = []
  for (let i = i0; i < i1; i += stepHours) {
    const j = Math.min(i1, i + stepHours)
    const row = { t: hours[i] }
    for (const g of groups) {
      let sum = 0
      for (const id of g.deviceIds) sum += deviceDelta(telemetry.series[id], i, j).kwh
      if (g.residual) {
        const master = deviceDelta(telemetry.series[MASTER_ID], i, j).kwh
        let metered = 0
        for (const dv of DEVICES) {
          if (dv.id === MASTER_ID) continue
          metered += deviceDelta(telemetry.series[dv.id], i, j).kwh
        }
        sum += Math.max(0, master - metered) * (g.residualShare ?? 1)
      }
      row[g.key] = sum
    }
    days.push(row)
  }
  return days
}

/** Hourly kW for the last `n` hours — for the live demand strip. */
export function recentPower (telemetry, deviceId, n = 48) {
  const { hours, series } = telemetry
  const s = series[deviceId]
  const end = hours.length - 1
  const out = []
  for (let i = Math.max(1, end - n + 1); i <= end; i++) {
    out.push({ t: hours[i], kw: s.ok[i] ? s.kw[i] : null })
  }
  return out
}

export function round3 (n) {
  return Math.round(n * 1000) / 1000
}

export { HOUR }
