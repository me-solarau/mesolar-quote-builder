/**
 * View helpers shared by the tenant and owner screens, plus the permission
 * boundary (`visibleTo`).
 *
 * IMPORTANT: `visibleTo` is a *projection*, not a security control. This build
 * has no backend, so every participant's figures are computed in the browser
 * and a determined reader can open the console and see them. In production the
 * same shape is enforced by row-level security in the database, and the client
 * never receives another participant's rows at all. Keeping the projection
 * here means the server policy and the UI agree about what a role may see.
 */

import { DEVICES, DEVICE_BY_ID, MASTER_ID, TENANTS, AREA_BY_ID, PHASES } from '../data/site.js'
import { deviceDelta } from './allocation.js'

/** Devices explicitly assigned to a participant, under current assignments. */
export function devicesFor (tenantId, assignments = {}) {
  return DEVICES.filter(
    (d) => d.id !== MASTER_ID && (assignments[d.id] ?? d.assignment) === `tenant:${tenantId}`
  )
}

export function communalDevices (assignments = {}) {
  return DEVICES.filter(
    (d) => d.id !== MASTER_ID && (assignments[d.id] ?? d.assignment) === 'communal'
  )
}

/** Instantaneous kW right now for a set of devices; null if all are offline. */
export function liveKw (telemetry, deviceIds) {
  const last = telemetry.hours.length - 1
  let sum = 0
  let any = false
  for (const id of deviceIds) {
    const s = telemetry.series[id]
    if (!s) continue
    if (s.ok[last]) { sum += s.kw[last]; any = true }
  }
  return any ? sum : null
}

/** The main tenant's live demand is the master less everything measured. */
export function liveResidualKw (telemetry) {
  const last = telemetry.hours.length - 1
  const master = telemetry.series[MASTER_ID].kw[last]
  let metered = 0
  for (const d of DEVICES) {
    if (d.id === MASTER_ID) continue
    const s = telemetry.series[d.id]
    if (s.ok[last]) metered += s.kw[last]
  }
  return Math.max(0, master - metered)
}

/** Hourly kW for a participant over the last `n` hours, gaps preserved. */
export function participantPower (telemetry, tenantId, assignments, n = 48) {
  const last = telemetry.hours.length - 1
  const ids = devicesFor(tenantId, assignments).map((d) => d.id)
  const isResidual = TENANTS.find((t) => t.id === tenantId)?.isResidual
  const out = []
  for (let i = Math.max(0, last - n + 1); i <= last; i++) {
    let v = 0
    let ok = true
    for (const id of ids) {
      const s = telemetry.series[id]
      if (s.ok[i]) v += s.kw[i]
      else ok = false
    }
    if (isResidual) {
      let metered = 0
      for (const d of DEVICES) {
        if (d.id === MASTER_ID) continue
        const s = telemetry.series[d.id]
        if (s.ok[i]) metered += s.kw[i]
      }
      v += Math.max(0, telemetry.series[MASTER_ID].kw[i] - metered)
      ok = true
    }
    out.push({ t: telemetry.hours[i], kw: ok || v > 0 ? v : null })
  }
  return out
}

/**
 * Bucketed kWh for a participant — direct plus communal share.
 * `stepHours` of 24 gives daily buckets, 1 gives hourly (used by the Today
 * range, where a daily bucket would be a single bar).
 */
export function participantDaily (telemetry, allocation, tenantId, assignments, splitShare, stepHours = 24) {
  const { i0, i1 } = allocation
  const ids = devicesFor(tenantId, assignments).map((d) => d.id)
  const communalIds = communalDevices(assignments).map((d) => d.id)
  const isResidual = TENANTS.find((t) => t.id === tenantId)?.isResidual
  const rows = []

  for (let i = i0; i < i1; i += stepHours) {
    const j = Math.min(i1, i + stepHours)
    let direct = 0
    for (const id of ids) direct += deviceDelta(telemetry.series[id], i, j).kwh

    let communal = 0
    for (const id of communalIds) communal += deviceDelta(telemetry.series[id], i, j).kwh

    if (isResidual) {
      const master = deviceDelta(telemetry.series[MASTER_ID], i, j).kwh
      let metered = 0
      for (const d of DEVICES) {
        if (d.id === MASTER_ID) continue
        metered += deviceDelta(telemetry.series[d.id], i, j).kwh
      }
      direct += Math.max(0, master - metered)
    }

    rows.push({ t: telemetry.hours[i], direct, communal: communal * splitShare })
  }
  return rows
}

/** Per-device rows for one participant, with a share-of-total figure. */
export function deviceRowsFor (allocation, tenantId, assignments) {
  const ids = new Set(devicesFor(tenantId, assignments).map((d) => d.id))
  const rows = allocation.devices.filter((r) => ids.has(r.deviceId))
  const total = rows.reduce((a, r) => a + r.kwh, 0)
  return rows
    .map((r) => ({
      ...r,
      device: DEVICE_BY_ID[r.deviceId],
      areaName: AREA_BY_ID[DEVICE_BY_ID[r.deviceId].area]?.name ?? '',
      share: total > 0 ? r.kwh / total : 0
    }))
    .sort((a, b) => b.kwh - a.kwh)
}

export function communalRows (allocation, assignments) {
  const ids = new Set(communalDevices(assignments).map((d) => d.id))
  const rows = allocation.devices.filter((r) => ids.has(r.deviceId))
  const total = rows.reduce((a, r) => a + r.kwh, 0)
  return rows
    .map((r) => ({
      ...r,
      device: DEVICE_BY_ID[r.deviceId],
      areaName: AREA_BY_ID[DEVICE_BY_ID[r.deviceId].area]?.name ?? '',
      share: total > 0 ? r.kwh / total : 0
    }))
    .sort((a, b) => b.kwh - a.kwh)
}

/** kWh grouped by load type — what the energy was actually used for. */
export function byLoadType (rows) {
  const out = {}
  for (const r of rows) {
    const lt = r.device?.loadType ?? r.loadType
    out[lt] = (out[lt] ?? 0) + r.kwh
  }
  return out
}

/** How far through an open period we are, 0..1. */
export function periodProgress (period, nowMs) {
  const span = period.endMs - period.startMs
  return Math.max(0, Math.min(1, (nowMs - period.startMs) / span))
}

/** Days elapsed / total, for "day 28 of 31". */
export function periodDays (period, nowMs) {
  const day = 86400_000
  const total = Math.round((period.endMs - period.startMs) / day)
  const elapsed = Math.min(total, Math.max(0, Math.ceil((Math.min(nowMs, period.endMs) - period.startMs) / day)))
  return { elapsed, total }
}

/**
 * Project an open period to its end using the run-rate so far. Clearly an
 * estimate — every screen that shows it says so.
 */
export function projectToEnd (valueSoFar, period, nowMs) {
  const p = periodProgress(period, nowMs)
  return p > 0.02 ? valueSoFar / p : null
}

/* ------------------------------------------------------------------ */
/* Electrical detail (FR-02) — voltage and current where available     */
/* ------------------------------------------------------------------ */

/**
 * Live per-phase electrical state.
 *
 * The Pro 3EM reports voltage and current per phase directly. The 1PM Gen3 and
 * EM Gen3 report power and current; voltage is a per-phase measurement, so each
 * device inherits the voltage of the phase it sits on. That is what the real
 * integration would do too — a relay meter does not measure the supply, it
 * measures its own circuit.
 *
 * Voltage is modelled as a small sag under load from a 242 V open-circuit
 * value, which is what a 230 V nominal AU supply actually looks like.
 */
export function liveElectrical (telemetry) {
  const last = telemetry.hours.length - 1
  const byPhase = Object.fromEntries(PHASES.map((p) => [p, { phase: p, kw: 0, devices: 0 }]))

  for (const dv of DEVICES) {
    if (dv.id === MASTER_ID || !dv.phase) continue
    const s = telemetry.series[dv.id]
    if (!s.ok[last]) continue
    byPhase[dv.phase].kw += s.kw[last]
    byPhase[dv.phase].devices++
  }

  // The main tenant's unmetered load is three-phase plant (cool-room
  // compressors), so it is spread evenly rather than attributed to one phase.
  const residualKw = liveResidualKw(telemetry) / PHASES.length
  for (const p of PHASES) byPhase[p].kw += residualKw

  const phases = PHASES.map((p) => {
    const kw = byPhase[p].kw
    // Solve for the operating point of V = 242 - 0.06*A with A = P/V.
    let volts = 242
    for (let i = 0; i < 4; i++) volts = 242 - 0.06 * ((kw * 1000) / volts)
    const amps = (kw * 1000) / volts
    return { phase: p, kw, volts, amps, devices: byPhase[p].devices }
  })

  const voltsOf = Object.fromEntries(phases.map((p) => [p.phase, p.volts]))
  const devices = {}
  for (const dv of DEVICES) {
    if (dv.id === MASTER_ID) continue
    const s = telemetry.series[dv.id]
    const online = !!s.ok[last]
    const volts = voltsOf[dv.phase] ?? null
    devices[dv.id] = {
      online,
      kw: online ? s.kw[last] : null,
      volts: online ? volts : null,
      amps: online && volts ? (s.kw[last] * 1000) / volts : null,
      // Headroom against the meter's own rating, which is what decides whether
      // a 1PM is the right device for a circuit at all.
      utilisation: online && volts ? (s.kw[last] * 1000) / volts / dv.maxAmps : null
    }
  }

  const totalKw = phases.reduce((a, p) => a + p.kw, 0)
  const maxA = Math.max(...phases.map((p) => p.amps))
  const minA = Math.min(...phases.map((p) => p.amps))
  return {
    phases,
    devices,
    totalKw,
    // Phase imbalance matters on a 50 A supply: one phase can trip while the
    // other two sit half idle.
    imbalance: maxA > 0 ? (maxA - minA) / maxA : 0,
    maxAmps: maxA,
    supplyRatingA: 50
  }
}


/* ------------------------------------------------------------------ */
/* Permission boundary                                                  */
/* ------------------------------------------------------------------ */

/**
 * What a session is allowed to see of an allocation.
 *
 * - `owner` and `installer` get the whole thing.
 * - a `tenant` gets their own row, the communal totals everyone shares, the
 *   site total their share is a percentage of, and nothing else. Specifically
 *   not: another participant's kWh, cost, or device-level readings.
 *
 * Acceptance criterion 7 — "tenant can only view their own private usage plus
 * communal allocation" — is this function plus the routing guard in App.jsx.
 */
export function visibleTo (session, allocation) {
  if (!session) return null
  if (session.role === 'owner' || session.role === 'installer') {
    return { scope: 'site', allocation }
  }

  const tid = session.tenantId
  const own = allocation.perTenant[tid]
  const communalIds = new Set(
    DEVICES.filter((d) => d.id !== MASTER_ID && d.assignment === 'communal').map((d) => d.id)
  )
  const ownIds = new Set(
    DEVICES.filter((d) => d.assignment === `tenant:${tid}`).map((d) => d.id)
  )

  return {
    scope: 'tenant',
    tenantId: tid,
    // The participant's own figures.
    own,
    // Shared context they are entitled to, because their bill is derived from it.
    communalKwh: allocation.communalKwh,
    masterKwh: allocation.reconciliation.masterKwh,
    splitShare: allocation.splitShares[tid],
    distributable: allocation.reconciliation.distributable,
    // Device rows: their own, plus communal endpoints (whose totals they are
    // charged a share of and are therefore entitled to check).
    devices: allocation.devices.filter(
      (d) => ownIds.has(d.deviceId) || communalIds.has(d.deviceId)
    ),
    // Data-quality facts that affect their own bill.
    integrity: {
      atRiskKwh: allocation.reconciliation.atRiskKwh,
      atRiskPct: allocation.reconciliation.atRiskPct,
      blocked: allocation.reconciliation.integrityBlocked
    }
  }
}

/** True if `session` may read this participant's figures. */
export function canRead (session, tenantId) {
  if (!session) return false
  if (session.role === 'owner' || session.role === 'installer') return true
  return session.tenantId === tenantId
}
