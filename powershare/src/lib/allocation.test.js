import { test } from 'node:test'
import assert from 'node:assert/strict'

import { allocate, deviceDelta, energyAtRisk, splitShares } from './allocation.js'
import { buildTelemetry } from '../data/simulate.js'
import { BILLING_PERIODS, RETAILER_BILLS } from '../data/seed.js'
import { DEFAULT_SPLIT_RULE, SITE, TENANTS, DEVICES, MASTER_ID } from '../data/site.js'

const telemetry = buildTelemetry()
const period = BILLING_PERIODS[2] // a closed period with an entered bill
const bill = RETAILER_BILLS.find((b) => b.periodId === period.id)
const run = (over = {}) =>
  allocate({ telemetry, period, splitRule: DEFAULT_SPLIT_RULE, bill, site: SITE, ...over })

test('a counter reset never produces a negative delta', () => {
  const current = allocate({
    telemetry,
    period: BILLING_PERIODS[3],
    splitRule: DEFAULT_SPLIT_RULE,
    site: SITE
  })
  const laundry = current.devices.find((d) => d.deviceId === 'laundry-light')
  assert.ok(laundry.rawKwh < 0, 'the raw end-minus-start delta is negative')
  assert.ok(laundry.kwh > 0, 'the corrected delta is positive')
  assert.equal(laundry.corrections.length, 1)
  assert.equal(laundry.corrections[0].type, 'reset')
})

test('a gap the meter rode out locally puts no energy at risk', () => {
  const current = allocate({
    telemetry,
    period: BILLING_PERIODS[3],
    splitRule: DEFAULT_SPLIT_RULE,
    site: SITE
  })
  const gapped = current.devices.find((d) => d.deviceId === 'computer-gpo')
  assert.ok(gapped.coverage < 1, 'coverage records the missing samples')
  assert.equal(gapped.atRiskKwh, 0, 'but the cumulative counter caught up')
})

test('a frozen counter is reported as energy at risk', () => {
  const current = allocate({
    telemetry,
    period: BILLING_PERIODS[3],
    splitRule: DEFAULT_SPLIT_RULE,
    site: SITE
  })
  const down = current.devices.find((d) => d.deviceId === 'shared-ac')
  assert.ok(down.frozenHours > 100)
  assert.ok(down.atRiskKwh > 20)
  assert.equal(current.reconciliation.integrityBlocked, true,
    'materially incomplete data blocks statement issue')
})

test('allocated kWh sums exactly to the master read', () => {
  const r = run()
  const total = Object.values(r.perTenant).reduce((a, x) => a + x.allocatedKwh, 0)
  assert.ok(Math.abs(total - r.reconciliation.masterKwh) < 1e-6)
  assert.ok(Math.abs(r.reconciliation.kwhReconciliationError) < 1e-9)
})

test('allocated cost sums exactly to the distributable amount', () => {
  const r = run()
  const total = Object.values(r.perTenant).reduce((a, x) => a + x.cost, 0)
  assert.ok(Math.abs(total - bill.distributableAmount) < 1e-6)
})

test('the residual never double-counts an explicitly assigned device', () => {
  const r = run()
  const main = r.perTenant.main
  const explicit = DEVICES.filter((d) => d.id !== MASTER_ID)
    .reduce((a, d) => {
      const row = r.devices.find((x) => x.deviceId === d.id)
      return a + row.kwh
    }, 0)
  assert.ok(
    Math.abs(main.residualKwh - (r.reconciliation.masterKwh - explicit)) < 1e-6,
    'residual is exactly master less every explicit endpoint'
  )
  assert.equal(main.privateMeteredKwh, 0, 'main tenant holds no private meters')
})

test('reassigning a device moves energy between participants without changing the total', () => {
  const before = run()
  const after = run({ assignments: { 'kitchen-gpo': 'tenant:bed1' } })
  const kitchen = before.devices.find((d) => d.deviceId === 'kitchen-gpo').kwh

  assert.ok(Math.abs(after.communalKwh - (before.communalKwh - kitchen)) < 1e-6)
  assert.ok(after.perTenant.bed1.directKwh > before.perTenant.bed1.directKwh)

  const t1 = Object.values(before.perTenant).reduce((a, x) => a + x.allocatedKwh, 0)
  const t2 = Object.values(after.perTenant).reduce((a, x) => a + x.allocatedKwh, 0)
  assert.ok(Math.abs(t1 - t2) < 1e-6, 'the site total is unchanged')
})

test('equal split gives every participant 25%', () => {
  const shares = splitShares(DEFAULT_SPLIT_RULE, TENANTS.map((t) => t.id))
  for (const v of Object.values(shares)) assert.ok(Math.abs(v - 0.25) < 1e-12)
})

test('weighted split normalises whatever weights it is given', () => {
  const shares = splitShares(
    { mode: 'weighted', weights: { bed1: 1, bed2: 1, armand: 1, main: 3 } },
    ['bed1', 'bed2', 'armand', 'main']
  )
  assert.ok(Math.abs(shares.main - 0.5) < 1e-12)
  assert.ok(Math.abs(Object.values(shares).reduce((a, b) => a + b, 0) - 1) < 1e-12)
})

test('a zero-weight rule falls back to an equal split rather than dividing by zero', () => {
  const shares = splitShares({ mode: 'weighted', weights: {} }, ['a', 'b'])
  assert.deepEqual(shares, { a: 0.5, b: 0.5 })
})

test('master read agrees with the retailer bill to within 1%', () => {
  for (const b of RETAILER_BILLS) {
    const p = BILLING_PERIODS.find((x) => x.id === b.periodId)
    const r = allocate({ telemetry, period: p, splitRule: DEFAULT_SPLIT_RULE, bill: b, site: SITE })
    assert.ok(Math.abs(r.reconciliation.billKwhVariance) < 0.01,
      `${p.label} variance ${r.reconciliation.billKwhVariance}`)
  }
})

test('deviceDelta and energyAtRisk agree on a clean series', () => {
  const clean = telemetry.series['bed1-gpo']
  const d = deviceDelta(clean, 0, 100)
  assert.ok(Math.abs(d.kwh - d.rawKwh) < 1e-9)
  assert.equal(d.coverage, 1)
  assert.equal(energyAtRisk(clean, 0, 100).kwh, 0)
})

/* ------------------------------------------------------------------ */
/* Permission boundary                                                  */
/* ------------------------------------------------------------------ */

test('a tenant projection exposes their own row and no other participant', async () => {
  const { visibleTo, canRead } = await import('./views.js')
  const r = run()
  const view = visibleTo({ role: 'tenant', tenantId: 'bed1' }, r)

  assert.equal(view.scope, 'tenant')
  assert.equal(view.tenantId, 'bed1')
  assert.equal(view.own.tenantId, 'bed1')
  assert.equal(view.perTenant, undefined, 'the full per-participant map is not exposed')

  const ids = view.devices.map((d) => d.deviceId)
  assert.ok(ids.includes('bed1-gpo'), 'their own endpoints are visible')
  assert.ok(ids.includes('kitchen-gpo'), 'communal endpoints they are charged for are visible')
  assert.ok(!ids.includes('bed2-gpo'), 'another tenant’s endpoint is not')
  assert.ok(!ids.includes('armand-ac'), 'nor another tenant’s private air conditioner')

  assert.equal(canRead({ role: 'tenant', tenantId: 'bed1' }, 'bed1'), true)
  assert.equal(canRead({ role: 'tenant', tenantId: 'bed1' }, 'bed2'), false)
  assert.equal(canRead({ role: 'owner' }, 'bed2'), true)
})

test('the owner projection is the whole site', async () => {
  const { visibleTo } = await import('./views.js')
  const view = visibleTo({ role: 'owner' }, run())
  assert.equal(view.scope, 'site')
  assert.equal(Object.keys(view.allocation.perTenant).length, 4)
})
