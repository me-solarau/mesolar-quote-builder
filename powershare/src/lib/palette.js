/**
 * Chart palette.
 *
 * Every set below was checked with the data-viz validator in BOTH modes
 * (lightness band, chroma floor, adjacent-pair CVD separation, normal-vision
 * floor, contrast vs surface) before being used. Do not add a hue by eye —
 * re-run the validator on the new ordering.
 *
 *   participant order (stacks/bars): blue, orange, aqua, yellow, violet
 *     light — worst adjacent CVD ΔE 9.1, normal-vision ΔE 22.9  → PASS
 *     dark  — worst adjacent CVD ΔE 8.4, normal-vision ΔE 19.8  → PASS
 *
 *   load-type order: yellow, blue, aqua, orange
 *     light — CVD ΔE 9.2, normal ΔE 24.0 → PASS
 *     dark  — CVD ΔE 9.4, normal ΔE 20.9 → PASS
 *
 * Three light-mode hues sit below 3:1 against the light surface, so the relief
 * rule applies: every chart using them ships direct labels and a table view.
 */

const LIGHT = {
  blue: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
  yellow: '#eda100',
  violet: '#4a3aa7'
}

const DARK = {
  blue: '#3987e5',
  orange: '#d95926',
  aqua: '#199e70',
  yellow: '#c98500',
  violet: '#9085e9'
}

/** Status colours are fixed — never themed, never reused as a series colour. */
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b'
}

export function isDark () {
  if (typeof document === 'undefined') return false
  const stamped = document.documentElement.getAttribute('data-theme')
  if (stamped === 'dark') return true
  if (stamped === 'light') return false
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function ramp () {
  return isDark() ? DARK : LIGHT
}

/** Colour follows the entity, never its rank in a filtered list. */
export function participantColor (tenantId) {
  const r = ramp()
  return {
    bed1: r.blue,
    bed2: r.orange,
    armand: r.aqua,
    main: r.violet
  }[tenantId] ?? r.blue
}

/** The communal pool, when it is a series alongside participants. */
export function communalColor () {
  return ramp().yellow
}

export function loadTypeColor (loadType) {
  const r = ramp()
  return {
    light: r.yellow,
    gpo: r.blue,
    ac: r.aqua,
    cooking: r.orange,
    master: r.violet
  }[loadType] ?? r.blue
}

/** Fixed stack order — the validated adjacency, not the data's order. */
export const LOAD_TYPE_ORDER = ['light', 'gpo', 'ac', 'cooking']
export const PARTICIPANT_ORDER = ['bed1', 'bed2', 'armand', 'main']

export function chromeColors () {
  const d = isDark()
  return {
    surface: d ? '#1a1a19' : '#fcfcfb',
    grid: d ? '#2c2c2a' : '#e1e0d9',
    axis: d ? '#383835' : '#c3c2b7',
    muted: '#898781',
    text: d ? '#ffffff' : '#0b0b0b'
  }
}
