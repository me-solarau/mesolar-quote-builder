import { chromeColors } from '../../lib/palette.js'
import { kwh, pct } from '../../lib/format.js'
import { useMeasure, useThemeTick, niceTicks } from './primitives.jsx'
import { useState } from 'react'

/**
 * Horizontal bars with direct labels. Used for tenant comparison and device
 * breakdowns — the form for "how big is each of these", where the category
 * names are words and deserve to be read horizontally.
 *
 * 4px rounded data-ends, anchored square to the baseline.
 */
export function BarList ({ items, unit = 'kWh', height = 26, showValue = (v) => kwh(v, 1), max: maxProp }) {
  useThemeTick()
  const [hover, setHover] = useState(null)
  const max = maxProp ?? Math.max(0.0001, ...items.map((i) => i.value))
  const c = chromeColors()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it) => {
        const w = Math.max(0, (it.value / max) * 100)
        return (
          <div key={it.key}
            onMouseEnter={() => setHover(it.key)}
            onMouseLeave={() => setHover(null)}
            style={{ display: 'grid', gridTemplateColumns: 'minmax(104px, 32%) 1fr auto', alignItems: 'center', gap: 10 }}>
            <div title={it.label}
              style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {it.label}
            </div>
            <div style={{ position: 'relative', height, display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'var(--surface-2)', borderRadius: 4 }} />
              <div style={{
                position: 'relative', height: '100%', width: `${w}%`,
                background: it.color, borderRadius: '2px 4px 4px 2px',
                minWidth: it.value > 0 ? 3 : 0,
                outline: hover === it.key ? `2px solid ${c.surface}` : 'none',
                boxShadow: hover === it.key ? `0 0 0 3px ${it.color}55` : 'none',
                transition: 'box-shadow .12s'
              }} />
            </div>
            <div className="num" style={{ fontSize: 13, fontWeight: 550, minWidth: 78, textAlign: 'right' }}>
              {showValue(it.value)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{unit}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * A single composition bar — "what makes up the site total". Preferred over a
 * donut: one axis, exact widths, and the segment labels sit right below.
 */
export function CompositionBar ({ segments, total, height = 34 }) {
  useThemeTick()
  const [hover, setHover] = useState(null)
  const c = chromeColors()
  return (
    <div>
      <div style={{ display: 'flex', height, borderRadius: 6, overflow: 'hidden', gap: 2, background: 'var(--surface-2)' }}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.key}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
            title={`${s.label}: ${kwh(s.value, 1)} kWh (${pct(s.value / total)})`}
            style={{
              flex: `${s.value} 0 0`, background: s.color, minWidth: 3,
              boxShadow: hover === s.key ? `inset 0 0 0 2px ${c.surface}` : 'none'
            }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginTop: 10 }}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
            <span className="legend-swatch" style={{ background: s.color }} />
            <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
            <span className="num" style={{ fontWeight: 600 }}>{pct(s.value / total, 1)}</span>
            <span className="num" style={{ color: 'var(--text-muted)' }}>
              {/* Small ranges (a single day) round to nothing at 0 dp. */}
              {kwh(s.value, total < 100 ? 1 : 0)} kWh
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Grouped vertical bars — period-over-period comparison per participant.
 * One value axis, categories along the bottom, 2px gap between adjacent bars.
 */
export function GroupedBars ({ groups, series, height = 210, unit = 'kWh', valueFormat = (v) => kwh(v, 0) }) {
  useThemeTick()
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState(null)
  const c = chromeColors()
  const pad = { top: 12, right: 10, bottom: 40, left: 46 }
  const plotW = Math.max(60, width - pad.left - pad.right)
  const plotH = height - pad.top - pad.bottom

  const max = Math.max(0.0001, ...groups.flatMap((g) => series.map((s) => g.values[s.key] ?? 0)))
  const ticks = niceTicks(max, 4)
  const top = ticks[ticks.length - 1] || 1
  const y = (v) => pad.top + plotH - (v / top) * plotH

  const bandW = plotW / Math.max(1, groups.length)
  // Cap the group width: with one or two series a full-width band produces
  // slab-like bars that read as area, not as a value.
  const inner = Math.min(bandW * 0.76, series.length * 56)
  const barW = Math.max(3, inner / series.length - 2)

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={pad.left} x2={pad.left + plotW} y1={y(t)} y2={y(t)} stroke={c.grid} />
            <text className="tick" x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fill={c.muted}>{t}</text>
          </g>
        ))}
        {groups.map((g, gi) => {
          const x0 = pad.left + gi * bandW + (bandW - inner) / 2
          return (
            <g key={g.key}>
              {series.map((s, si) => {
                const v = g.values[s.key] ?? 0
                const h = Math.max(0, y(0) - y(v))
                const bx = x0 + si * (barW + 2)
                const key = `${g.key}:${s.key}`
                return (
                  <g key={s.key}
                    onMouseEnter={() => setHover({ key, g, s, v })}
                    onMouseLeave={() => setHover(null)}>
                    <rect x={bx} y={y(v)} width={barW} height={h} rx="3" fill={s.color}
                      stroke={hover?.key === key ? c.surface : 'none'} strokeWidth="2" />
                    <rect x={bx} y={pad.top} width={barW} height={plotH} fill="transparent" />
                  </g>
                )
              })}
              <text className="tick" x={pad.left + gi * bandW + bandW / 2} y={height - 22}
                textAnchor="middle" fill={c.muted}>{g.label}</text>
              {g.subLabel && (
                <text className="tick" x={pad.left + gi * bandW + bandW / 2} y={height - 8}
                  textAnchor="middle" fill={c.muted} opacity="0.75">{g.subLabel}</text>
              )}
            </g>
          )
        })}
        <line className="axis-line" x1={pad.left} x2={pad.left + plotW} y1={y(0)} y2={y(0)} stroke={c.axis} />
      </svg>
      {hover && (
        <div className="tooltip" style={{ left: 8, top: 4, position: 'absolute' }}>
          <div className="t-title">{hover.g.label}</div>
          <div className="t-row">
            <span className="sw" style={{ background: hover.s.color }} />
            <span className="lbl">{hover.s.label}</span>
            <span className="val">{valueFormat(hover.v)} {unit}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/** Coverage meter — a single 0-100% bar with a threshold mark. */
export function CoverageMeter ({ value, threshold, height = 8 }) {
  const colour = value >= 0.995 ? 'var(--good)' : value >= 0.97 ? 'var(--warning)' : 'var(--critical)'
  return (
    <div style={{ position: 'relative', height, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ height: '100%', width: `${Math.min(100, value * 100)}%`, background: colour, borderRadius: 999 }} />
      {threshold != null && (
        <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${threshold * 100}%`, width: 2, background: 'var(--line-strong)' }} />
      )}
    </div>
  )
}
