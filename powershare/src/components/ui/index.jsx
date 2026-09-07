import { useEffect, useRef } from 'react'

/* ------------------------------------------------------------------ */
/* Icons — inline so the app carries no icon dependency                */
/* ------------------------------------------------------------------ */

const PATHS = {
  home: 'M3 10.2 12 3l9 7.2V21H14v-6h-4v6H3z',
  usage: 'M3 20h18M6 20V9m5 11V4m5 16v-7',
  cost: 'M12 2v20M17 6.5c0-2-2.2-3-5-3s-5 .9-5 3 2.5 2.8 5 3.4 5 1.3 5 3.6-2.2 3-5 3-5-1-5-3',
  history: 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3 4v5h5M12 7.5V12l3 2',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.4M12 17h.01',
  dashboard: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  people: 'M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20M10 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 5.2a3.5 3.5 0 0 1 0 6.6',
  devices: 'M4 4h16v11H4zM9 19h6M12 15v4M8 8h2M8 11h5',
  billing: 'M4 3h16v18l-2.7-1.6L14.6 21l-2.6-1.6L9.4 21l-2.7-1.6L4 21zM8 8h8M8 12h8M8 16h5',
  reports: 'M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h4',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 8 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H2a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 3.7 8a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 8 3.7h.1A1.6 1.6 0 0 0 9.2 2.1V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.6 1.1H22a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.1Z',
  alert: 'M12 9v4.5M12 17h.01M10.3 3.9 2.4 17.4A2 2 0 0 0 4.1 20.4h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  check: 'M20 6 9 17l-5-5',
  bolt: 'M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z',
  plug: 'M9 3v6M15 3v6M6 9h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6zM12 18v3',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z',
  snow: 'M12 2v20M4.2 7l15.6 10M19.8 7 4.2 17M9 4l3 2 3-2M9 20l3-2 3 2',
  flame: 'M12 22a7 7 0 0 0 7-7c0-4-3-6-4.5-9.5C13 8 12 9 10.5 9.5 9 7 9 5 9 3.5 6.5 6 5 9 5 15a7 7 0 0 0 7 7Z',
  gauge: 'M12 21a9 9 0 1 1 9-9M12 12l5-4',
  download: 'M12 3v12M7 11l5 4 5-4M4 20h16',
  print: 'M7 8V3h10v5M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 15h10v6H7z',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11',
  wifi: 'M2.5 9a15 15 0 0 1 19 0M5.5 12.5a10 10 0 0 1 13 0M8.5 16a5.5 5.5 0 0 1 7 0M12 19.5h.01',
  wifiOff: 'M2 2l20 20M8.5 16a5.5 5.5 0 0 1 6-1.1M5.5 12.5a10 10 0 0 1 3.4-2.2M2.5 9a15 15 0 0 1 5-3.3M13.5 5.7A15 15 0 0 1 21.5 9M12 19.5h.01',
  plus: 'M12 5v14M5 12h14',
  chevron: 'M9 5l7 7-7 7',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.5h.01',
  scales: 'M12 3v18M7 21h10M6 7l-3 6h6zM18 7l-3 6h6zM4 7h16',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2'
}

export function Icon ({ name, size = 16, style, strokeWidth = 1.6 }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"
      style={{ flex: 'none', ...style }}>
      <path d={d} stroke="currentColor" strokeWidth={strokeWidth}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export const LOAD_ICON = { gpo: 'plug', light: 'bulb', ac: 'snow', cooking: 'flame', master: 'gauge' }

/* ------------------------------------------------------------------ */
/* Layout pieces                                                       */
/* ------------------------------------------------------------------ */

export function Card ({ title, subtitle, action, children, className = '', ...rest }) {
  return (
    <section className={`card ${className}`} {...rest}>
      {(title || action) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <div className="card-note">{subtitle}</div>}
          </div>
          <div className="spacer" />
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat ({ label, value, unit, sub, delta, hero }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={hero ? 'hero-value num' : 'stat-value num'}>
        {value}{unit && <span className="unit">{unit}</span>}
      </div>
      {(sub || delta) && (
        <div className="stat-sub">
          {delta}
          {delta && sub ? ' · ' : ''}
          {sub}
        </div>
      )}
    </div>
  )
}

export function Delta ({ value, invert = false, suffix = '' }) {
  if (value == null || !isFinite(value)) return null
  const rounded = Math.abs(value) < 0.005 ? 0 : value
  const dir = rounded === 0 ? 'flat' : rounded > 0 ? (invert ? 'down' : 'up') : (invert ? 'up' : 'down')
  const arrow = rounded === 0 ? '±' : rounded > 0 ? '▲' : '▼'
  return (
    <span className={`delta ${dir}`}>
      {arrow} {Math.abs(rounded * 100).toFixed(1)}%{suffix}
    </span>
  )
}

export function Badge ({ tone = 'neutral', icon, children }) {
  const cls = { good: 'good', warn: 'warn', bad: 'bad', info: 'info', neutral: '' }[tone] ?? ''
  return (
    <span className={`badge ${cls}`}>
      {icon ? <Icon name={icon} size={12} /> : <span className="dot" />}
      {children}
    </span>
  )
}

export function Notice ({ tone = 'neutral', icon = 'info', title, children, action }) {
  const cls = { warn: 'warn', bad: 'bad', good: 'good', neutral: '' }[tone] ?? ''
  return (
    <div className={`notice ${cls}`} role={tone === 'bad' ? 'alert' : 'status'}>
      <span className="icon"><Icon name={icon} size={16} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <strong>{title}</strong>}
        {title && children ? <br /> : null}
        {children}
      </div>
      {action}
    </div>
  )
}

export function Segmented ({ options, value, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

export function Modal ({ title, onClose, children, footer, wide }) {
  const ref = useRef(null)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label={title}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(11,11,11,.42)',
        display: 'grid', placeItems: 'center', padding: 16
      }}>
      <div ref={ref} tabIndex={-1} className="card"
        style={{ width: '100%', maxWidth: wide ? 720 : 460, maxHeight: '86vh', overflowY: 'auto', boxShadow: 'var(--shadow)' }}>
        <div className="card-head">
          <h2>{title}</h2>
          <div className="spacer" />
          <button className="btn ghost sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
        {footer && <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>{footer}</div>}
      </div>
    </div>
  )
}

export function Field ({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}

export function Avatar ({ name, color, size = 30 }) {
  const init = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <span className="avatar" style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}>
      {init}
    </span>
  )
}

export function Empty ({ icon = 'info', title, children }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
      <Icon name={icon} size={26} />
      <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginTop: 8 }}>{title}</div>
      {children && <div style={{ fontSize: 13, marginTop: 4 }}>{children}</div>}
    </div>
  )
}
