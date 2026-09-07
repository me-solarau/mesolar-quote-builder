/**
 * Site model — the physical property described in the PRD.
 *
 * Four cost participants, seven monitored areas (1 GPO + 1 light each), two air
 * conditioners, a CT-metered 32 A stove/oven and a 3-phase 50 A master meter.
 * Device count matches the PRD shopping list exactly:
 *   16 x Shelly 1PM Gen3  = 7 GPOs + 7 lights + 2 ACs
 *    1 x Shelly EM Gen3   = stove/oven (via 50 A CT)
 *    1 x Shelly Pro 3EM   = 3-phase master / reconciliation reference
 */

export const SITE = {
  id: 'site-1',
  name: '14 Kembla Street',
  suburb: 'Wollongong NSW',
  supply: '3-phase, 50 A mains',
  timezone: 'Australia/Sydney',
  // Reconciliation guard rails, editable by the owner in Settings.
  residualExpectedMin: 0.15, // main-tenant residual should sit between 15%…
  residualExpectedMax: 0.55, // …and 55% of master, else something is unmetered
  integrityThreshold: 0.015  // >1.5% of master at risk blocks statement issue
}

/** Cost participants. `main` is the residual holder — it owns no meters. */
export const TENANTS = [
  {
    id: 'bed1',
    name: 'Bedroom Tenant 1',
    shortName: 'Bedroom 1',
    contact: 'sarah.n@example.com',
    kind: 'bedroom',
    colorSlot: 1
  },
  {
    id: 'bed2',
    name: 'Bedroom Tenant 2',
    shortName: 'Bedroom 2',
    contact: 'devi.r@example.com',
    kind: 'bedroom',
    colorSlot: 2
  },
  {
    id: 'armand',
    name: 'Armand',
    shortName: 'Armand',
    contact: 'armand@example.com',
    kind: 'bedroom',
    note: 'Has a dedicated air conditioner on a private circuit.',
    colorSlot: 3
  },
  {
    id: 'main',
    name: 'Main Tenant',
    shortName: 'Main Tenant',
    contact: 'ops@coolroom.example.com',
    kind: 'main',
    isResidual: true,
    note: 'Operates the cool rooms. Charged the residual: master less every ' +
      'explicitly metered private and communal endpoint.',
    colorSlot: 7
  }
]

export const AREAS = [
  { id: 'bed1', name: 'Bedroom 1', kind: 'private' },
  { id: 'bed2', name: 'Bedroom 2', kind: 'private' },
  { id: 'armand', name: "Armand's Room", kind: 'private' },
  { id: 'computer', name: 'Computer Room', kind: 'communal' },
  { id: 'kitchen', name: 'Kitchen', kind: 'communal' },
  { id: 'bathroom', name: 'Bathroom', kind: 'communal' },
  { id: 'laundry', name: 'Laundry', kind: 'communal' },
  { id: 'plant', name: 'Switchboard / Plant', kind: 'infrastructure' }
]

/** Load categories drive both the icons and the usage breakdown charts. */
export const LOAD_TYPES = {
  gpo: { id: 'gpo', label: 'GPO / power points' },
  light: { id: 'light', label: 'Lighting' },
  ac: { id: 'ac', label: 'Air conditioning' },
  cooking: { id: 'cooking', label: 'Cooking' },
  master: { id: 'master', label: 'Master metering' }
}

/**
 * Every device. `assignment` is what the allocation engine reads:
 *   tenant:<id> — private usage billed direct to that participant
 *   communal    — pooled and split by the communal split rule
 *   master      — the reconciliation reference, never billed directly
 */
export const DEVICES = [
  // --- Bedroom 1 (private) ---
  d('bed1-gpo', 'Bedroom 1 GPO', 'bed1', 'gpo', 'tenant:bed1', '1PM'),
  d('bed1-light', 'Bedroom 1 Lighting', 'bed1', 'light', 'tenant:bed1', '1PM'),

  // --- Bedroom 2 (private) ---
  d('bed2-gpo', 'Bedroom 2 GPO', 'bed2', 'gpo', 'tenant:bed2', '1PM'),
  d('bed2-light', 'Bedroom 2 Lighting', 'bed2', 'light', 'tenant:bed2', '1PM'),

  // --- Armand (private, incl. his own AC) ---
  d('armand-gpo', "Armand's GPO", 'armand', 'gpo', 'tenant:armand', '1PM'),
  d('armand-light', "Armand's Lighting", 'armand', 'light', 'tenant:armand', '1PM'),
  d('armand-ac', "Armand's Air Conditioner", 'armand', 'ac', 'tenant:armand', '1PM', {
    note: 'Private large load. Nameplate 1.8 kW / 8.2 A running — inside the ' +
      '1PM Gen3 envelope; inrush verified at commissioning.'
  }),

  // --- Communal areas ---
  d('computer-gpo', 'Computer Room GPO', 'computer', 'gpo', 'communal', '1PM'),
  d('computer-light', 'Computer Room Lighting', 'computer', 'light', 'communal', '1PM'),
  d('kitchen-gpo', 'Kitchen GPO', 'kitchen', 'gpo', 'communal', '1PM'),
  d('kitchen-light', 'Kitchen Lighting', 'kitchen', 'light', 'communal', '1PM'),
  d('bathroom-gpo', 'Bathroom GPO', 'bathroom', 'gpo', 'communal', '1PM'),
  d('bathroom-light', 'Bathroom Lighting', 'bathroom', 'light', 'communal', '1PM'),
  d('laundry-gpo', 'Laundry GPO', 'laundry', 'gpo', 'communal', '1PM'),
  d('laundry-light', 'Laundry Lighting', 'laundry', 'light', 'communal', '1PM'),
  d('shared-ac', 'Shared Air Conditioner', 'computer', 'ac', 'communal', '1PM', {
    note: 'Serves the communal living/computer area.'
  }),
  d('stove', 'Stove / Oven (32 A)', 'kitchen', 'cooking', 'communal', 'EM', {
    note: 'CT-metered on the dedicated 32 A circuit — the load does not pass ' +
      'through a 16 A relay.'
  }),

  // --- Master ---
  d('master-3em', 'Master 3-Phase Meter', 'plant', 'master', 'master', 'Pro3EM', {
    phases: ['L1', 'L2', 'L3'],
    note: 'Installed on L1/L2/L3 of the 3-phase 50 A supply. The ' +
      'reconciliation reference for every billing period.'
  })
]

function d (id, name, area, loadType, assignment, model, extra = {}) {
  const MODELS = {
    '1PM': { model: 'Shelly 1PM Gen3', metering: 'relay', maxAmps: 16 },
    EM: { model: 'Shelly EM Gen3 + 50 A CT', metering: 'ct', maxAmps: 50 },
    Pro3EM: { model: 'Shelly Pro 3EM 120 A', metering: 'ct', maxAmps: 120 }
  }
  return {
    id,
    name,
    area,
    loadType,
    assignment,
    ...MODELS[model],
    // Stable fake identifiers so the Devices screen looks like a real fleet.
    mac: fakeMac(id),
    ip: fakeIp(id),
    firmware: '1.4.4',
    commissionedAt: '2026-05-09',
    ...extra
  }
}

function fakeMac (id) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const b = []
  for (let i = 0; i < 3; i++) b.push(((h >> (i * 8)) & 0xff).toString(16).padStart(2, '0'))
  return ['8c', '4b', '14', ...b].join(':').toUpperCase()
}

function fakeIp (id) {
  let h = 0
  for (const ch of id) h = (h * 17 + ch.charCodeAt(0)) >>> 0
  return `192.168.10.${(h % 200) + 20}`
}

export const DEVICE_BY_ID = Object.fromEntries(DEVICES.map((x) => [x.id, x]))
export const MASTER_ID = 'master-3em'
export const TENANT_BY_ID = Object.fromEntries(TENANTS.map((t) => [t.id, t]))
export const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]))

/** Participants that receive a share of communal usage. */
export const COMMUNAL_PARTICIPANTS = TENANTS.map((t) => t.id)

/** Default communal split rule — the PRD's base assumption of 25% each. */
export const DEFAULT_SPLIT_RULE = {
  id: 'equal-4',
  name: 'Equal share (25% each)',
  mode: 'equal',
  weights: Object.fromEntries(COMMUNAL_PARTICIPANTS.map((id) => [id, 25]))
}
