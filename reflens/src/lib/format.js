export function fmtDate (iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
export function fmtDateTime (iso) {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
export function pct (x, digits = 0) {
  return x == null || Number.isNaN(x) ? '—' : `${(x * 100).toFixed(digits)}%`
}
export function ago (iso, now = Date.now()) {
  const s = Math.round((now - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
