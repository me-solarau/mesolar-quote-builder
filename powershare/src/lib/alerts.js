/**
 * Alerts (FR-11).
 *
 * Every alert names the device, the money-or-energy consequence, and what to do
 * about it. "Something looks wrong" is not an alert; "39 kWh is being charged to
 * the wrong participant" is.
 */

import { DEVICE_BY_ID, TENANT_BY_ID } from '../data/site.js'
import { duration, kwh } from './format.js'

export function buildAlerts ({ allocation, telemetry, site }) {
  const alerts = []
  const { reconciliation, devices } = allocation

  for (const row of devices) {
    const dv = DEVICE_BY_ID[row.deviceId]
    const s = telemetry.series[row.deviceId]
    const lastOkIndex = lastOk(s, allocation.i1)
    const offline = !s.ok[allocation.i1]

    if (offline) {
      // Hours since the end of the last good bucket, matching the "last
      // reading" figure the device tables show.
      const downHours = allocation.i1 - lastOkIndex
      const severity = row.atRiskKwh > 10 ? 'critical' : 'warning'
      alerts.push({
        id: `offline:${row.deviceId}`,
        severity,
        kind: 'offline',
        deviceId: row.deviceId,
        title: `${dv.name} is offline`,
        body: `No data for ${duration(downHours)}. ` +
          (row.atRiskKwh > 0.5
            ? `About ${kwh(row.atRiskKwh, 1)} kWh has passed through the master ` +
              `without being attributed — it is currently falling into the main ` +
              `tenant’s residual.`
            : 'No material energy at risk yet.'),
        action: 'Check Wi-Fi coverage at the device, then re-verify in Devices.'
      })
    } else if (row.coverage < 0.995) {
      alerts.push({
        id: `gap:${row.deviceId}`,
        severity: 'info',
        kind: 'gap',
        deviceId: row.deviceId,
        title: `${dv.name} had a reporting gap`,
        body: `${row.gapHours} h of samples missing this period. The cumulative ` +
          'counter caught up on reconnect, so no energy was lost from the ' +
          'billing calculation.',
        action: 'No action needed. Recurrent gaps suggest weak signal.'
      })
    }

    for (const corr of row.corrections) {
      alerts.push({
        id: `reset:${row.deviceId}:${corr.atIndex}`,
        severity: 'warning',
        kind: 'reset',
        deviceId: row.deviceId,
        title: `${dv.name} counter was reset`,
        body: `The cumulative reading dropped by ${kwh(corr.lostRawKwh, 1)} kWh ` +
          'mid-period. The raw end-minus-start delta would have been ' +
          `${kwh(row.rawKwh, 1)} kWh — negative, and unusable. The period was ` +
          `rebuilt by summing only the forward steps, giving ${kwh(row.kwh, 1)} kWh.`,
        action: 'Correction is recorded in the audit trail. Verify against the device.'
      })
    }
  }

  if (!reconciliation.residualWithinBand) {
    const high = reconciliation.residualPct > (site.residualExpectedMax ?? 1)
    alerts.push({
      id: 'residual-band',
      severity: 'warning',
      kind: 'reconciliation',
      title: `Main-tenant residual is ${high ? 'above' : 'below'} its expected range`,
      body: `The residual is ${(reconciliation.residualPct * 100).toFixed(1)}% of the ` +
        `master read; the configured band is ` +
        `${((site.residualExpectedMin ?? 0) * 100).toFixed(0)}–` +
        `${((site.residualExpectedMax ?? 1) * 100).toFixed(0)}%. ` +
        (high
          ? 'A load that should be metered may be missing, or a meter is offline.'
          : 'A device may be assigned to the wrong participant, or double-counted.'),
      action: 'Review device assignments and offline meters before issuing statements.'
    })
  }

  if (reconciliation.rawResidualKwh < 0) {
    alerts.push({
      id: 'negative-residual',
      severity: 'critical',
      kind: 'reconciliation',
      title: 'Assigned endpoints exceed the master read',
      body: `Explicit endpoints total ${kwh(reconciliation.meteredKwh, 1)} kWh against ` +
        `a master read of ${kwh(reconciliation.masterKwh, 1)} kWh. That is physically ` +
        'impossible and means a circuit is being counted twice, or the master ' +
        'CT set is misconfigured.',
      action: 'Do not issue statements. Check for a device metered on two channels.'
    })
  }

  if (reconciliation.integrityBlocked) {
    alerts.push({
      id: 'integrity-block',
      severity: 'critical',
      kind: 'integrity',
      title: 'Statement generation is blocked for this period',
      body: `${kwh(reconciliation.atRiskKwh, 1)} kWh ` +
        `(${(reconciliation.atRiskPct * 100).toFixed(2)}% of the master read) passed ` +
        'through the site without being attributed to a meter. That is above the ' +
        `${((site.integrityThreshold ?? 0.015) * 100).toFixed(1)}% threshold.`,
      action: 'Restore the offline meters, or override with a recorded reason.'
    })
  }

  if (reconciliation.billKwhVariance != null && Math.abs(reconciliation.billKwhVariance) > 0.02) {
    // billKwhVariance is a fraction of the retailer's figure, so recover the
    // retailer's kWh from it rather than printing the fraction as an energy.
    const retailerKwh = reconciliation.masterKwh / (1 + reconciliation.billKwhVariance)
    alerts.push({
      id: 'bill-variance',
      severity: 'warning',
      kind: 'reconciliation',
      title: 'Master read disagrees with the retailer bill',
      body: `The master meter recorded ${kwh(reconciliation.masterKwh, 0)} kWh against ` +
        `the retailer’s ${kwh(retailerKwh, 0)} kWh — a variance of ` +
        `${(reconciliation.billKwhVariance * 100).toFixed(1)}%.`,
      action: 'Check the bill period dates match the metering period exactly.'
    })
  }

  const order = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity])
}

function lastOk (series, upTo) {
  for (let i = upTo; i >= 0; i--) if (series.ok[i]) return i
  return 0
}

export function severityTone (sev) {
  return { critical: 'bad', warning: 'warn', info: 'neutral' }[sev] ?? 'neutral'
}

export function tenantName (id) {
  return TENANT_BY_ID[id]?.name ?? id
}
