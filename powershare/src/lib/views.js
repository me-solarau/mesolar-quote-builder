/**
 * View helpers shared by the tenant and owner screens.
 *
 * The permission boundary lives here: `visibleTo` is the only thing a tenant
 * screen is allowed to read. In production this is enforced by row-level
 * security in the database, not by the client — this function is the shape of
 * that policy, not a substitute for it.
 */

import { DEVICES, DEVICE_BY_ID, MASTER_ID, TENANTS, AREA_BY_ID } from '../data/site.js'
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

/** Daily kWh for a participant across a period — direct plus communal share. */
export function participantDaily (telemetry, allocation, tenantId, assignments, splitShare) {
  const { i0, i1 } = allocation
  const ids = devicesFor(tenantId, assignments).map((d) => d.id)
  const communalIds = communalDevices(assignments).map((d) => d.id)
  const isResidual = TENANTS.find((t) => t.id === tenantId)?.isResidual
  const rows = []

  for (let i = i0; i < i1; i += 24) {
    const j = Math.min(i1, i + 24)
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
