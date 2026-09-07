/**
 * Seed data — billing periods, retailer bills, issued statements and the
 * starting audit trail. In production these are owner-entered records in
 * Postgres; here they live in localStorage so the demo behaves like the real
 * thing (entries persist, statements stay issued) without a backend.
 */

import { DEFAULT_SPLIT_RULE } from './site.js'

const AEST = 10 * 3600_000
/** Local midnight (AEST) for a Y/M/D, as epoch ms. */
const at = (y, m, d, h = 0) => Date.UTC(y, m - 1, d, h) - AEST

export const BILLING_PERIODS = [
  {
    id: 'bp-2026-05',
    label: 'May – June 2026',
    startMs: at(2026, 5, 10),
    endMs: at(2026, 6, 10),
    status: 'closed'
  },
  {
    id: 'bp-2026-06',
    label: 'June – July 2026',
    startMs: at(2026, 6, 10),
    endMs: at(2026, 7, 10),
    status: 'closed'
  },
  {
    id: 'bp-2026-07',
    label: 'July – August 2026',
    startMs: at(2026, 7, 10),
    endMs: at(2026, 8, 10),
    status: 'closed'
  },
  {
    id: 'bp-2026-08',
    label: 'August – September 2026',
    startMs: at(2026, 8, 10),
    endMs: at(2026, 9, 10),
    status: 'open'
  }
]

export const CURRENT_PERIOD_ID = 'bp-2026-08'

/**
 * Retailer bills as entered by the owner (FR-07).
 *
 * `totalKwh` is what the retailer billed; `retailerTotal` is the whole invoice;
 * `distributableAmount` is the portion the owner intends to share across
 * tenants. For the MVP the owner decides that figure — usually the invoice less
 * anything they absorb (here: the daily supply charge on the owner's account).
 */
export const RETAILER_BILLS = [
  {
    id: 'rb-2026-05',
    periodId: 'bp-2026-05',
    retailer: 'Origin Energy',
    invoiceNo: 'INV-884201',
    startMs: at(2026, 5, 10),
    endMs: at(2026, 6, 10),
    totalKwh: 2262,
    retailerTotal: 830.0,
    distributableAmount: 746.46,
    supplyCharge: 83.54,
    enteredBy: 'owner',
    enteredAtMs: at(2026, 6, 14),
    note: 'Supply charge absorbed by owner; usage charges distributed.'
  },
  {
    id: 'rb-2026-06',
    periodId: 'bp-2026-06',
    retailer: 'Origin Energy',
    invoiceNo: 'INV-891773',
    startMs: at(2026, 6, 10),
    endMs: at(2026, 7, 10),
    totalKwh: 2248,
    retailerTotal: 847.86,
    distributableAmount: 764.32,
    supplyCharge: 83.54,
    enteredBy: 'owner',
    enteredAtMs: at(2026, 7, 13),
    note: 'Colder month — heating load up across both split systems.'
  },
  {
    id: 'rb-2026-07',
    periodId: 'bp-2026-07',
    retailer: 'Origin Energy',
    invoiceNo: 'INV-899502',
    startMs: at(2026, 7, 10),
    endMs: at(2026, 8, 10),
    totalKwh: 2279,
    retailerTotal: 869.8,
    distributableAmount: 786.26,
    supplyCharge: 83.54,
    enteredBy: 'owner',
    enteredAtMs: at(2026, 8, 12),
    note: ''
  }
]

export const SPLIT_RULES = [
  DEFAULT_SPLIT_RULE,
  {
    id: 'weighted-occupancy',
    name: 'Weighted by occupancy',
    mode: 'weighted',
    weights: { bed1: 20, bed2: 20, armand: 20, main: 40 },
    note: 'Reflects the main tenant’s daytime use of the communal kitchen and ' +
      'bathroom during trading hours. Not currently active.'
  }
]

export const ACTIVE_SPLIT_RULE_ID = 'equal-4'

/** Statements already issued for the closed periods. */
export const ISSUED_STATEMENTS = [
  { periodId: 'bp-2026-05', issuedAtMs: at(2026, 6, 14, 9), issuedBy: 'owner' },
  { periodId: 'bp-2026-06', issuedAtMs: at(2026, 7, 13, 10), issuedBy: 'owner' },
  { periodId: 'bp-2026-07', issuedAtMs: at(2026, 8, 12, 9), issuedBy: 'owner' }
]

export const SEED_AUDIT = [
  {
    tsMs: at(2026, 5, 9, 15),
    actor: 'installer',
    action: 'device.commissioned',
    summary: 'Commissioned 18 meters and verified live values against the master.',
    detail: '16 x Shelly 1PM Gen3, 1 x Shelly EM Gen3 (stove CT), 1 x Shelly Pro 3EM.'
  },
  {
    tsMs: at(2026, 5, 9, 16),
    actor: 'owner',
    action: 'split_rule.set',
    summary: 'Communal split rule set to Equal share (25% each).',
    detail: 'Agreed with all four participants at the tenancy meeting on 8 May.'
  },
  {
    tsMs: at(2026, 6, 14, 9),
    actor: 'owner',
    action: 'statement.issued',
    summary: 'Issued statements for May – June 2026.',
    detail: 'Reconciled to Origin invoice INV-884201.'
  },
  {
    tsMs: at(2026, 7, 13, 10),
    actor: 'owner',
    action: 'statement.issued',
    summary: 'Issued statements for June – July 2026.',
    detail: 'Reconciled to Origin invoice INV-891773.'
  },
  {
    tsMs: at(2026, 8, 12, 9),
    actor: 'owner',
    action: 'statement.issued',
    summary: 'Issued statements for July – August 2026.',
    detail: 'Reconciled to Origin invoice INV-899502.'
  },
  {
    tsMs: at(2026, 8, 21, 4),
    actor: 'system',
    action: 'meter.reset_detected',
    summary: 'Laundry Lighting cumulative counter reset to zero.',
    detail: 'Firmware 1.4.2 -> 1.4.4. Delta rebuilt from the post-reset segment; ' +
      'raw end-minus-start delta would have been negative.'
  }
]

/**
 * Indicative usage rate for the *open* period, where no retailer bill exists
 * yet. Derived from the most recent issued bill (distributable / master kWh) so
 * an estimate is never a made-up number. Everything shown against it is
 * labelled "estimated" in the UI.
 */
export const ESTIMATE_SOURCE_BILL_ID = 'rb-2026-07'

/** Demo accounts for the sign-in screen. No real auth in this build. */
export const ACCOUNTS = [
  { id: 'owner', role: 'owner', name: 'Property Owner', email: 'owner@example.com' },
  { id: 'bed1', role: 'tenant', tenantId: 'bed1', name: 'Bedroom Tenant 1', email: 'sarah.n@example.com' },
  { id: 'bed2', role: 'tenant', tenantId: 'bed2', name: 'Bedroom Tenant 2', email: 'devi.r@example.com' },
  { id: 'armand', role: 'tenant', tenantId: 'armand', name: 'Armand', email: 'armand@example.com' },
  { id: 'main', role: 'tenant', tenantId: 'main', name: 'Main Tenant', email: 'ops@coolroom.example.com' },
  { id: 'installer', role: 'installer', name: 'Installer', email: 'installer@example.com' }
]
