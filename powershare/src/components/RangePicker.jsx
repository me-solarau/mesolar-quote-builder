import { Icon } from './ui/index.jsx'
import { date } from '../lib/format.js'

const DAY = 86400_000

/**
 * Date-range control (FR-03): Today, 7 Days, the billing period, or a custom
 * range. Billing always uses the billing period — this only re-scopes the
 * usage views, so a tenant can ask "what did I use yesterday" without it
 * implying anything about their bill.
 */
export function rangeFor (mode, period, nowMs, custom) {
  switch (mode) {
    case 'today': {
      const start = startOfLocalDay(nowMs)
      return { startMs: start, endMs: nowMs, label: 'Today', granularity: 'hour' }
    }
    case '7d':
      return {
        startMs: startOfLocalDay(nowMs - 6 * DAY),
        endMs: nowMs,
        label: 'Last 7 days',
        granularity: 'day'
      }
    case 'custom':
      return {
        startMs: custom.startMs,
        endMs: custom.endMs,
        label: `${date(custom.startMs)} – ${date(custom.endMs)}`,
        granularity: custom.endMs - custom.startMs <= 3 * DAY ? 'hour' : 'day'
      }
    case 'period':
    default:
      return {
        startMs: period.startMs,
        endMs: Math.min(nowMs, period.endMs),
        label: period.label,
        granularity: 'day'
      }
  }
}

/** Local midnight (AEST) for the day containing `ms`. */
function startOfLocalDay (ms) {
  const AEST = 10 * 3600_000
  return Math.floor((ms + AEST) / DAY) * DAY - AEST
}

const AEST = 10 * 3600_000
const toInput = (ms) => new Date(ms + AEST).toISOString().slice(0, 10)
const fromInput = (v) => Date.parse(`${v}T00:00:00Z`) - AEST

export default function RangePicker ({ mode, onMode, custom, onCustom, nowMs, earliestMs }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div className="seg" role="group" aria-label="Date range">
        {[
          { value: 'today', label: 'Today' },
          { value: '7d', label: '7 days' },
          { value: 'period', label: 'Billing period' },
          { value: 'custom', label: 'Custom' }
        ].map((o) => (
          <button key={o.value} type="button" aria-pressed={mode === o.value}
            onClick={() => onMode(o.value)}>
            {o.label}
          </button>
        ))}
      </div>

      {mode === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="clock" size={14} style={{ color: 'var(--text-muted)' }} />
          <input type="date" aria-label="Range start"
            value={toInput(custom.startMs)}
            min={toInput(earliestMs)} max={toInput(custom.endMs)}
            onChange={(e) => onCustom({ ...custom, startMs: fromInput(e.target.value) })}
            style={{ width: 148 }} />
          <span style={{ color: 'var(--text-muted)' }}>to</span>
          <input type="date" aria-label="Range end"
            value={toInput(custom.endMs)}
            min={toInput(custom.startMs)} max={toInput(nowMs)}
            onChange={(e) => onCustom({ ...custom, endMs: fromInput(e.target.value) })}
            style={{ width: 148 }} />
        </div>
      )}
    </div>
  )
}
