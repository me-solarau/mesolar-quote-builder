import { useEffect, useRef, useState, useCallback } from 'react'
import { chromeColors } from '../../lib/palette.js'

/** Measure the container so charts are fluid without a resize library. */
export function useMeasure () {
  const ref = useRef(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (w) setWidth(w)
    })
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width || 640)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/**
 * Re-render charts when the theme changes. The palette reads CSS-independent
 * hex values, so a theme flip has to be observed rather than inherited.
 */
export function useThemeTick () {
  const [, bump] = useState(0)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const onChange = () => bump((n) => n + 1)
    mq?.addEventListener?.('change', onChange)
    const mo = new MutationObserver(onChange)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      mq?.removeEventListener?.('change', onChange)
      mo.disconnect()
    }
  }, [])
}

export function niceTicks (max, count = 4) {
  if (!(max > 0)) return [0, 1]
  const raw = max / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  const ticks = []
  for (let v = 0; v <= max * 1.0001 + step * 0.5; v += step) ticks.push(Number(v.toFixed(6)))
  // The top tick defines the plot ceiling, so it must cover the data — a
  // rounded step can otherwise land just under the maximum and let a mark
  // draw outside the plot area.
  while (ticks[ticks.length - 1] < max) ticks.push(Number((ticks[ticks.length - 1] + step).toFixed(6)))
  return ticks
}

/** Recessive gridlines + left value axis. */
export function ValueAxis ({ ticks, y, x0, x1, format }) {
  const c = chromeColors()
  return (
    <g aria-hidden="true">
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid-line" x1={x0} x2={x1} y1={y(t)} y2={y(t)} stroke={c.grid} />
          <text className="tick" x={x0 - 8} y={y(t)} dy="0.32em" textAnchor="end" fill={c.muted}>
            {format ? format(t) : t}
          </text>
        </g>
      ))}
    </g>
  )
}

export function Tooltip ({ x, y, width, children }) {
  const style = {
    left: Math.max(4, Math.min(x + 12, width - 190)),
    top: Math.max(0, y - 10)
  }
  return <div className="tooltip" style={style}>{children}</div>
}

/** Shared pointer tracking for crosshair charts. */
export function usePointer (padLeft, plotW, n) {
  const [hover, setHover] = useState(null)
  const onMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const frac = (px - padLeft) / Math.max(1, plotW)
    const i = Math.round(frac * (n - 1))
    if (i < 0 || i > n - 1) { setHover(null); return }
    setHover({ i, px, py: e.clientY - rect.top })
  }, [padLeft, plotW, n])
  const onLeave = useCallback(() => setHover(null), [])
  return [hover, onMove, onLeave]
}

/**
 * The table view every chart ships with. It is the relief for palette slots
 * that sit below 3:1 against the light surface, and the accessible fallback
 * for anyone who cannot use the hover layer.
 */
export function ChartTable ({ columns, rows }) {
  return (
    <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
      <table className="data">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.numeric ? 'n' : ''}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} className={c.numeric ? 'n' : ''}>
                  {c.swatch && r[c.swatch]
                    ? <span className="swatch" style={{ background: r[c.swatch] }} />
                    : null}
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Legend ({ items }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span className="legend-item" key={it.label}>
          <span className="legend-swatch" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}
