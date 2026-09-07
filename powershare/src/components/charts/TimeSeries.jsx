import { useMemo } from 'react'
import { chromeColors } from '../../lib/palette.js'
import { dayMonth, time, kwh, kw } from '../../lib/format.js'
import { useMeasure, useThemeTick, niceTicks, ValueAxis, Tooltip, usePointer } from './primitives.jsx'

const PAD = { top: 10, right: 12, bottom: 26, left: 46 }

/**
 * Stacked daily energy. Series are drawn in a fixed order (the validated
 * adjacency), with a 2px surface gap between segments so neighbouring fills
 * never touch.
 */
export function StackedArea ({ data, series, height = 220, unit = 'kWh', xLabel = dayMonth }) {
  useThemeTick()
  const [ref, width] = useMeasure()
  const c = chromeColors()

  const plotW = Math.max(60, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom

  const { stacks, max } = useMemo(() => {
    let max = 0
    const stacks = data.map((row) => {
      let acc = 0
      const segs = series.map((s) => {
        const v = row[s.key] ?? 0
        const seg = { key: s.key, y0: acc, y1: acc + v, v }
        acc += v
        return seg
      })
      if (acc > max) max = acc
      return { t: row.t, total: acc, segs }
    })
    return { stacks, max }
  }, [data, series])

  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const y = (v) => PAD.top + plotH - (v / top) * plotH
  const n = data.length
  const bandW = plotW / Math.max(1, n)
  const x = (i) => PAD.left + i * bandW

  const [hover, onMove, onLeave] = usePointer(PAD.left, plotW, n)
  const barW = Math.max(1, bandW - (bandW > 6 ? 2 : 0.5))

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img"
        onMouseMove={onMove} onMouseLeave={onLeave}>
        <ValueAxis ticks={ticks} y={y} x0={PAD.left} x1={PAD.left + plotW} />
        {stacks.map((row, i) => (
          <g key={row.t}>
            {row.segs.map((seg) => {
              const h = Math.max(0, y(seg.y0) - y(seg.y1))
              if (h <= 0) return null
              return (
                <rect
                  key={seg.key}
                  x={x(i)}
                  // A 2px surface gap between stacked segments.
                  y={y(seg.y1)}
                  width={barW}
                  height={Math.max(0.5, h - (h > 3 ? 2 : 0))}
                  fill={series.find((s) => s.key === seg.key).color}
                />
              )
            })}
          </g>
        ))}
        <line className="axis-line" x1={PAD.left} x2={PAD.left + plotW}
          y1={PAD.top + plotH} y2={PAD.top + plotH} stroke={c.axis} />
        {hover != null && (
          <line x1={x(hover.i) + barW / 2} x2={x(hover.i) + barW / 2}
            y1={PAD.top} y2={PAD.top + plotH} stroke={c.axis} strokeWidth="1" strokeDasharray="3 3" />
        )}
        {data.map((row, i) => {
          const every = Math.ceil(n / Math.max(3, Math.floor(plotW / 62)))
          if (i % every !== 0) return null
          return (
            <text key={row.t} className="tick" x={x(i) + barW / 2} y={height - 8}
              textAnchor="middle" fill={c.muted}>{xLabel(row.t)}</text>
          )
        })}
      </svg>
      {hover != null && stacks[hover.i] && (
        <Tooltip x={hover.px} y={hover.py} width={width}>
          <div className="t-title">{dayMonth(stacks[hover.i].t)}</div>
          {[...stacks[hover.i].segs].reverse().map((seg) => (
            <div className="t-row" key={seg.key}>
              <span className="sw" style={{ background: series.find((s) => s.key === seg.key).color }} />
              <span className="lbl">{series.find((s) => s.key === seg.key).label}</span>
              <span className="val">{kwh(seg.v, 1)}</span>
            </div>
          ))}
          <div className="t-row t-total">
            <span className="lbl">Total</span>
            <span className="val">{kwh(stacks[hover.i].total, 1)} {unit}</span>
          </div>
        </Tooltip>
      )}
    </div>
  )
}

/** Live demand: one series, no legend — the card title names it. */
export function PowerLine ({ data, color, height = 120, label = 'Site demand' }) {
  useThemeTick()
  const [ref, width] = useMeasure()
  const c = chromeColors()
  const pad = { top: 8, right: 10, bottom: 20, left: 40 }
  const plotW = Math.max(40, width - pad.left - pad.right)
  const plotH = height - pad.top - pad.bottom

  const values = data.map((d) => d.kw).filter((v) => v != null)
  const max = Math.max(0.1, ...values)
  const ticks = niceTicks(max, 2)
  const top = ticks[ticks.length - 1] || 1
  const y = (v) => pad.top + plotH - (v / top) * plotH
  const x = (i) => pad.left + (i / Math.max(1, data.length - 1)) * plotW

  // Break the path wherever the meter reported nothing, rather than
  // interpolating across a gap and inventing data.
  const segments = []
  let cur = []
  data.forEach((d, i) => {
    if (d.kw == null) { if (cur.length) segments.push(cur); cur = [] } else cur.push([x(i), y(d.kw)])
  })
  if (cur.length) segments.push(cur)

  const [hover, onMove, onLeave] = usePointer(pad.left, plotW, data.length)

  return (
    <div className="chart" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img" aria-label={label}
        onMouseMove={onMove} onMouseLeave={onLeave}>
        <ValueAxis ticks={ticks} y={y} x0={pad.left} x1={pad.left + plotW}
          format={(t) => `${t}`} />
        {segments.map((seg, si) => (
          <g key={si}>
            <path d={`M ${seg.map((p) => p.join(' ')).join(' L ')} L ${seg[seg.length - 1][0]} ${y(0)} L ${seg[0][0]} ${y(0)} Z`}
              fill={color} opacity="0.13" />
            <path d={`M ${seg.map((p) => p.join(' ')).join(' L ')}`}
              fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        ))}
        <line className="axis-line" x1={pad.left} x2={pad.left + plotW} y1={y(0)} y2={y(0)} stroke={c.axis} />
        {hover != null && data[hover.i]?.kw != null && (
          <>
            <line x1={x(hover.i)} x2={x(hover.i)} y1={pad.top} y2={y(0)}
              stroke={c.axis} strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(hover.i)} cy={y(data[hover.i].kw)} r="4.5" fill={color}
              stroke={c.surface} strokeWidth="2" />
          </>
        )}
        {data.map((d, i) => {
          const every = Math.ceil(data.length / Math.max(3, Math.floor(plotW / 58)))
          if (i % every !== 0) return null
          return <text key={i} className="tick" x={x(i)} y={height - 6} textAnchor="middle" fill={c.muted}>{time(d.t)}</text>
        })}
      </svg>
      {hover != null && data[hover.i] && (
        <Tooltip x={hover.px} y={hover.py} width={width}>
          <div className="t-title">{dayMonth(data[hover.i].t)} {time(data[hover.i].t)}</div>
          <div className="t-row">
            <span className="sw" style={{ background: color }} />
            <span className="lbl">{label}</span>
            <span className="val">{data[hover.i].kw == null ? 'no data' : `${kw(data[hover.i].kw)} kW`}</span>
          </div>
        </Tooltip>
      )}
    </div>
  )
}

/** Compact sparkline for table rows and tiles. No axes, no hover. */
export function Sparkline ({ values, color, width = 88, height = 26 }) {
  if (!values?.length) return null
  const max = Math.max(...values, 0.0001)
  const step = width / Math.max(1, values.length - 1)
  const pts = values.map((v, i) => `${(i * step).toFixed(1)} ${(height - (v / max) * (height - 3) - 1.5).toFixed(1)}`)
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'block' }}>
      <path d={`M ${pts.join(' L ')}`} fill="none" stroke={color} strokeWidth="1.75"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
