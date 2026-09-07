/**
 * Deterministic telemetry generator.
 *
 * Stands in for the real data path (Shelly -> Home Assistant -> ingest API).
 * It produces the same thing that path would: an hourly series of **cumulative
 * kWh** per device, because cumulative energy — not integrated watts — is the
 * source of truth for billing (PRD section 4).
 *
 * Everything here is seeded, so every reload of the app shows the same site.
 */

import { DEVICES, MASTER_ID } from './site.js'

/** AEST. Sydney has no DST between May and September, so +10 holds all window. */
export const TZ_OFFSET_H = 10
const HOUR = 3600_000

/** Billing history starts 2026-05-10 00:00 AEST; "now" is 2026-09-07 14:00 AEST. */
export const START_MS = Date.UTC(2026, 4, 9, 14, 0, 0)
export const NOW_MS = Date.UTC(2026, 8, 7, 4, 0, 0)
export const HOURS = Math.round((NOW_MS - START_MS) / HOUR)

/* ------------------------------------------------------------------ */
/* Seeded randomness                                                    */
/* ------------------------------------------------------------------ */

function mulberry32 (seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFor (str) {
  let h = 2166136261
  for (const ch of str) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/* ------------------------------------------------------------------ */
/* Weather — drives both air conditioners                               */
/* ------------------------------------------------------------------ */

/**
 * Mean outdoor temperature for a given hour, Wollongong-ish: ~21 C summer mean,
 * ~12 C winter mean, with a daily swing peaking mid-afternoon.
 */
function temperatureAt (ms, rnd) {
  const doy = Math.floor((ms - Date.UTC(2026, 0, 1)) / 86400_000)
  const seasonal = 16.5 + 5.0 * Math.cos((2 * Math.PI * (doy - 15)) / 365)
  const h = hourOfDay(ms)
  const daily = -4.2 * Math.cos((2 * Math.PI * (h - 15)) / 24)
  // A slow synoptic wobble so warm and cold spells last a few days.
  const spell = 2.6 * Math.sin(doy / 3.1) + 1.4 * Math.sin(doy / 7.7)
  return seasonal + daily + spell + (rnd() - 0.5) * 1.5
}

export function hourOfDay (ms) {
  return Math.floor(((ms / HOUR) + TZ_OFFSET_H) % 24)
}

export function dayOfWeek (ms) {
  // 0 = Sunday, in local time.
  return new Date(ms + TZ_OFFSET_H * HOUR).getUTCDay()
}

/* ------------------------------------------------------------------ */
/* Load profiles — average kW drawn during a given hour                 */
/* ------------------------------------------------------------------ */

/** Bell curve helper: 1.0 at `peak`, tapering over `width` hours. */
function bell (h, peak, width) {
  let d = Math.abs(h - peak)
  if (d > 12) d = 24 - d
  return Math.exp(-(d * d) / (2 * width * width))
}

/** Heating/cooling duty as a 0..1 fraction of the hour the compressor runs. */
function hvacDuty (temp, comfortLow, comfortHigh) {
  if (temp < comfortLow) return Math.min(0.85, (comfortLow - temp) * 0.11)
  if (temp > comfortHigh) return Math.min(0.85, (temp - comfortHigh) * 0.13)
  return 0
}

const PROFILES = {
  // --- Bedroom 1: out at work on weekdays, home evenings ---
  'bed1-gpo': (h, dow, t, rnd) => {
    const weekend = dow === 0 || dow === 6
    const occupancy = weekend
      ? 0.35 + 0.5 * bell(h, 12, 5)
      : 0.15 + 0.85 * bell(h, 20, 3.2) + 0.3 * bell(h, 7, 1.4)
    return 0.035 + occupancy * 0.32 + (rnd() < 0.02 ? rnd() * 0.9 : 0)
  },
  'bed1-light': (h, dow, t, rnd) =>
    0.002 + 0.055 * (bell(h, 20.5, 2.6) + 0.4 * bell(h, 6.5, 1.2)) * (0.8 + rnd() * 0.4),

  // --- Bedroom 2: works from home, steady daytime draw ---
  'bed2-gpo': (h, dow, t, rnd) => {
    const weekday = dow >= 1 && dow <= 5
    const desk = weekday ? 0.9 * bell(h, 13, 4.5) : 0.3 * bell(h, 14, 5)
    return 0.045 + desk * 0.28 + 0.22 * bell(h, 20, 2.8) + (rnd() < 0.02 ? rnd() * 0.8 : 0)
  },
  'bed2-light': (h, dow, t, rnd) =>
    0.002 + 0.06 * (bell(h, 19.5, 3.0) + 0.5 * bell(h, 7, 1.5)) * (0.8 + rnd() * 0.4),

  // --- Armand ---
  'armand-gpo': (h, dow, t, rnd) =>
    0.05 + 0.3 * (0.2 + bell(h, 21, 3.4)) + (rnd() < 0.015 ? rnd() * 1.1 : 0),
  'armand-light': (h, dow, t, rnd) =>
    0.002 + 0.05 * (bell(h, 21, 3.0) + 0.3 * bell(h, 6, 1.2)) * (0.8 + rnd() * 0.4),
  // Private large load: 1.8 kW split system, run hard overnight.
  'armand-ac': (h, dow, t, rnd) => {
    const awake = Math.min(1, 0.35 + 0.65 * (bell(h, 21, 4) + 0.8 * bell(h, 3, 4)))
    return 1.8 * hvacDuty(t, 19.5, 24) * awake * (0.85 + rnd() * 0.3)
  },

  // --- Communal: computer room (always-on gear) ---
  'computer-gpo': (h, dow, t, rnd) => {
    const weekday = dow >= 1 && dow <= 5
    return 0.115 + (weekday ? 0.42 : 0.14) * bell(h, 13.5, 4.8) * (0.85 + rnd() * 0.3)
  },
  'computer-light': (h, dow, t, rnd) =>
    0.004 + 0.07 * (bell(h, 14, 5) + bell(h, 20, 2.5)) * (0.8 + rnd() * 0.4),

  // --- Communal: kitchen (fridge base + meal-time appliances) ---
  'kitchen-gpo': (h, dow, t, rnd) => {
    const fridge = 0.085 + 0.02 * Math.max(0, t - 18) / 10
    const kettleEtc = (bell(h, 7.5, 1.1) + bell(h, 12.5, 1.2) + bell(h, 18, 1.6)) * 0.55
    return fridge + kettleEtc * (0.6 + rnd() * 0.8)
  },
  'kitchen-light': (h, dow, t, rnd) =>
    0.004 + 0.075 * (bell(h, 18.5, 2.4) + 0.6 * bell(h, 7, 1.5)) * (0.8 + rnd() * 0.4),

  // --- Communal: bathroom (exhaust fan + heated towel rail in winter) ---
  'bathroom-gpo': (h, dow, t, rnd) => {
    const rail = t < 16 ? 0.28 * (bell(h, 7, 2) + bell(h, 19, 2.2)) : 0.05 * bell(h, 7, 1.5)
    return 0.012 + rail * (0.8 + rnd() * 0.4)
  },
  'bathroom-light': (h, dow, t, rnd) =>
    0.003 + 0.05 * (bell(h, 7, 1.8) + bell(h, 20, 2.6)) * (0.8 + rnd() * 0.4),

  // --- Communal: laundry (a few wash cycles a week, dryer when cold) ---
  'laundry-gpo': (h, dow, t, rnd) => {
    const washWindow = bell(h, 10, 2) + 0.7 * bell(h, 19, 2)
    const running = rnd() < 0.1 * washWindow
    const dryer = t < 15 && rnd() < 0.045 * washWindow
    return 0.008 + (running ? 0.42 + rnd() * 0.25 : 0) + (dryer ? 2.1 : 0)
  },
  'laundry-light': (h, dow, t, rnd) =>
    0.002 + 0.04 * (bell(h, 10, 2) + bell(h, 19, 2)) * (0.8 + rnd() * 0.4),

  // --- Communal: shared 2.4 kW split system in the living/computer area ---
  'shared-ac': (h, dow, t, rnd) => {
    const occupied = Math.min(1, 0.25 + 0.75 * (bell(h, 13, 5) + 0.9 * bell(h, 20, 3)))
    return 2.4 * hvacDuty(t, 18.5, 25) * occupied * (0.85 + rnd() * 0.3)
  },

  // --- Communal: 32 A stove/oven, CT metered ---
  stove: (h, dow, t, rnd) => {
    const dinner = bell(h, 18.5, 1.2)
    const lunch = 0.35 * bell(h, 12.5, 1.0)
    const bake = (dow === 0 || dow === 6) && rnd() < 0.09 ? 2.4 : 0
    return (dinner + lunch) * (1.6 + rnd() * 2.6) + bake
  }
}

/**
 * Main-tenant business load — the cool rooms plus unallocated back-of-house.
 * Deliberately NOT metered: it is what the residual calculation must recover.
 */
function mainDirectKw (h, dow, t, rnd) {
  const weekday = dow >= 1 && dow <= 5
  // Two cool rooms cycling 24/7; compressor works harder when it is warm and
  // when doors are opening during trading hours.
  const ambient = 0.95 + Math.max(0, t - 14) * 0.045
  const doorLoad = weekday ? 0.42 * bell(h, 11, 4.5) : 0.1
  const defrost = rnd() < 0.05 ? 0.55 : 0
  const backOfHouse = weekday ? 0.16 * bell(h, 12, 5) : 0.02
  return ambient + doorLoad + defrost + backOfHouse * 1.4 + (rnd() - 0.5) * 0.08
}

/**
 * Calibration. The profile functions above carry the *shape* of each load —
 * when it runs, how weather and occupancy move it. These targets carry the
 * *magnitude*: the mean daily kWh each endpoint is normalised to, taken from
 * typical AU appliance figures for a share house of this size. Seasonality and
 * day-to-day variation survive normalisation; only the overall level is set.
 */
export const DAILY_TARGET_KWH = {
  'bed1-gpo': 2.1,
  'bed1-light': 0.35,
  'bed2-gpo': 3.0, // works from home
  'bed2-light': 0.45,
  'armand-gpo': 2.4,
  'armand-light': 0.4,
  'armand-ac': 6.2, // private 1.8 kW split system
  'computer-gpo': 6.5, // always-on gear
  'computer-light': 0.9,
  'kitchen-gpo': 3.4, // fridge base plus meal-time appliances
  'kitchen-light': 0.5,
  'bathroom-gpo': 1.6, // heated towel rail through winter
  'bathroom-light': 0.4,
  'laundry-gpo': 2.2,
  'laundry-light': 0.25,
  'shared-ac': 9.0, // 2.4 kW communal split system
  stove: 3.8
}

/** Cool rooms plus back-of-house — the main tenant's unmetered business load. */
export const MAIN_DIRECT_TARGET_KWH = 30.0

/* ------------------------------------------------------------------ */
/* Injected data-quality events — the app must surface these honestly   */
/* ------------------------------------------------------------------ */

export const INJECTED_EVENTS = [
  {
    deviceId: 'laundry-light',
    type: 'reset',
    // Firmware update wiped the cumulative counter mid-period.
    atMs: Date.UTC(2026, 7, 21, 3, 0, 0),
    reason: 'Counter reset to zero after a firmware update (1.4.2 -> 1.4.4).'
  },
  {
    deviceId: 'computer-gpo',
    type: 'gap',
    // Wi-Fi dropout: no samples reached the gateway, but the meter kept counting
    // locally, so the cumulative value is intact on the far side.
    fromMs: Date.UTC(2026, 7, 14, 5, 0, 0),
    hours: 19,
    recovered: true,
    reason: 'Wi-Fi dropout at the access point. Meter kept counting locally; ' +
      'cumulative value reconciled on reconnect.'
  },
  {
    deviceId: 'shared-ac',
    type: 'offline',
    // Down for five days. A 2.4 kW communal load that is still running but no
    // longer measured — its energy lands on the main tenant's residual, which
    // is exactly the silent distortion the PRD says must never happen.
    fromMs: Date.UTC(2026, 8, 2, 2, 0, 0),
    reason: 'No response since 12:00 on 2 Sep. Suspected access-point coverage ' +
      'issue in the communal area — the AC itself is still running.'
  },
  {
    deviceId: 'bathroom-gpo',
    type: 'offline',
    // Still down right now — energy is flowing through the master but is not
    // being attributed, so it silently lands on the main tenant's residual.
    fromMs: Date.UTC(2026, 8, 6, 21, 0, 0),
    reason: 'Device unreachable since 07:00. Load is still passing through the ' +
      'master meter but is no longer being attributed.'
  }
]

/* ------------------------------------------------------------------ */
/* Build                                                                */
/* ------------------------------------------------------------------ */


/** Scale an hourly series so its mean daily total equals `targetPerDay`. */
function normaliseToDaily (arr, targetPerDay) {
  let sum = 0
  for (let i = 0; i < arr.length; i++) sum += arr[i]
  const days = arr.length / 24
  if (sum <= 0) return arr
  const k = (targetPerDay * days) / sum
  for (let i = 0; i < arr.length; i++) arr[i] *= k
  return arr
}

/**
 * @returns {{
 *   hours: Float64Array, series: Record<string, {cum: Float64Array, kwh: Float64Array,
 *   kw: Float64Array, ok: Uint8Array}>, events: object[]
 * }}
 */
export function buildTelemetry () {
  const hours = new Float64Array(HOURS)
  for (let i = 0; i < HOURS; i++) hours[i] = START_MS + i * HOUR

  const weatherRnd = mulberry32(seedFor('weather'))
  const temps = new Float64Array(HOURS)
  for (let i = 0; i < HOURS; i++) temps[i] = temperatureAt(hours[i], weatherRnd)

  const series = {}
  const metered = DEVICES.filter((dv) => dv.id !== MASTER_ID)

  // True (physical) consumption for every metered device.
  const trueKwh = {}
  for (const dv of metered) {
    const rnd = mulberry32(seedFor(dv.id))
    const arr = new Float64Array(HOURS)
    const profile = PROFILES[dv.id]
    for (let i = 0; i < HOURS; i++) {
      const kw = Math.max(0, profile(hourOfDay(hours[i]), dayOfWeek(hours[i]), temps[i], rnd))
      arr[i] = kw // 1 hour, so kW average == kWh for the hour
    }
    normaliseToDaily(arr, DAILY_TARGET_KWH[dv.id] ?? 1)
    trueKwh[dv.id] = arr
  }

  // Main tenant's unmetered business load.
  const mainRnd = mulberry32(seedFor('main-direct'))
  const mainKwh = new Float64Array(HOURS)
  for (let i = 0; i < HOURS; i++) {
    mainKwh[i] = Math.max(0, mainDirectKw(hourOfDay(hours[i]), dayOfWeek(hours[i]), temps[i], mainRnd))
  }
  normaliseToDaily(mainKwh, MAIN_DIRECT_TARGET_KWH)

  // Master sees everything, whether or not a submeter reported it.
  const masterKwh = new Float64Array(HOURS)
  for (let i = 0; i < HOURS; i++) {
    let sum = mainKwh[i]
    for (const dv of metered) sum += trueKwh[dv.id][i]
    // Small distribution/measurement difference between CT sets, ~0.4%.
    masterKwh[i] = sum * 1.004
  }

  // Now degrade the *recorded* series with the injected events.
  const idxOf = (ms) => Math.max(0, Math.min(HOURS - 1, Math.round((ms - START_MS) / HOUR)))

  for (const dv of metered) {
    const kwh = trueKwh[dv.id]
    const cum = new Float64Array(HOURS)
    const ok = new Uint8Array(HOURS).fill(1)
    // Meters do not start from zero — they were commissioned with history.
    let running = 40 + (seedFor(dv.id) % 400) / 10
    for (let i = 0; i < HOURS; i++) {
      running += kwh[i]
      cum[i] = running
    }
    series[dv.id] = { cum, kwh: kwh.slice(), kw: kwh.slice(), ok }
  }

  for (const ev of INJECTED_EVENTS) {
    const s = series[ev.deviceId]
    if (!s) continue
    if (ev.type === 'reset') {
      const at = idxOf(ev.atMs)
      const offset = s.cum[at]
      for (let i = at; i < HOURS; i++) s.cum[i] -= offset
    } else if (ev.type === 'gap') {
      const from = idxOf(ev.fromMs)
      for (let i = from; i < Math.min(HOURS, from + ev.hours); i++) s.ok[i] = 0
    } else if (ev.type === 'offline') {
      const from = idxOf(ev.fromMs)
      const frozen = s.cum[from]
      for (let i = from; i < HOURS; i++) {
        s.ok[i] = 0
        // The gateway keeps the last value it saw; real usage keeps climbing.
        s.cum[i] = frozen
        s.kw[i] = 0
      }
    }
  }

  // Master series last, so it is never degraded.
  {
    const cum = new Float64Array(HOURS)
    let running = 18422.6
    for (let i = 0; i < HOURS; i++) {
      running += masterKwh[i]
      cum[i] = running
    }
    series[MASTER_ID] = {
      cum,
      kwh: masterKwh,
      kw: masterKwh.slice(),
      ok: new Uint8Array(HOURS).fill(1)
    }
  }

  return {
    hours,
    temps,
    series,
    trueKwh,
    mainKwh,
    events: INJECTED_EVENTS
  }
}

/** Index of the hour containing `ms`, clamped to the generated window. */
export function hourIndex (hoursArr, ms) {
  const i = Math.round((ms - hoursArr[0]) / HOUR)
  return Math.max(0, Math.min(hoursArr.length - 1, i))
}
