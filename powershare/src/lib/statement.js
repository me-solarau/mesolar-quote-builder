/**
 * Statement snapshots (FR-10).
 *
 * A statement freezes the numbers at the moment it is issued. Changing a split
 * rule or a device assignment afterwards recalculates the *live* view, never a
 * statement someone has already been asked to pay. That immutability is what
 * makes the audit trail meaningful.
 */

import { TENANTS, SITE } from '../data/site.js'

export function buildSnapshot ({ period, allocation, splitRule, bill, override }) {
  const rec = allocation.reconciliation
  return {
    periodId: period.id,
    periodLabel: period.label,
    startMs: period.startMs,
    endMs: period.endMs,
    siteName: SITE.name,
    siteSuburb: SITE.suburb,
    masterKwh: rec.masterKwh,
    meteredKwh: rec.meteredKwh,
    communalKwh: allocation.communalKwh,
    residualKwh: allocation.mainDirectKwh,
    distributable: rec.distributable,
    splitRuleName: splitRule?.name ?? 'Equal share',
    splitShares: { ...allocation.splitShares },
    bill: bill
      ? {
          retailer: bill.retailer,
          invoiceNo: bill.invoiceNo,
          totalKwh: bill.totalKwh,
          retailerTotal: bill.retailerTotal,
          distributableAmount: bill.distributableAmount,
          supplyCharge: bill.supplyCharge ?? null,
          note: bill.note ?? ''
        }
      : null,
    rows: TENANTS.map((t) => {
      const x = allocation.perTenant[t.id]
      return {
        tenantId: t.id,
        name: t.name,
        isResidual: !!t.isResidual,
        privateMeteredKwh: x.privateMeteredKwh,
        residualKwh: x.residualKwh,
        directKwh: x.directKwh,
        communalShareKwh: x.communalShareKwh,
        communalSharePct: x.communalSharePct,
        allocatedKwh: x.allocatedKwh,
        sharePct: x.sharePct,
        cost: x.cost
      }
    }),
    integrity: {
      atRiskKwh: rec.atRiskKwh,
      atRiskPct: rec.atRiskPct,
      blocked: rec.integrityBlocked,
      billKwhVariance: rec.billKwhVariance,
      override: override ? { reason: override.reason, by: override.by, byMs: override.byMs } : null
    },
    corrections: allocation.devices
      .filter((d) => d.corrections.length)
      .map((d) => ({
        deviceId: d.deviceId,
        name: d.name,
        rawKwh: d.rawKwh,
        billedKwh: d.kwh,
        corrections: d.corrections
      }))
  }
}
