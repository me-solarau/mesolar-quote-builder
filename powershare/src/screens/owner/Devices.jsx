import { useState, useMemo } from 'react'

import { useApp } from '../../lib/useApp.jsx'
import { DEVICES, MASTER_ID, TENANTS, AREA_BY_ID } from '../../data/site.js'
import { participantColor, communalColor, loadTypeColor } from '../../lib/palette.js'
import { kwh, kw, pct, ago } from '../../lib/format.js'
import { severityTone } from '../../lib/alerts.js'
import {
  Card, Badge, Icon, Notice, Modal, Field, Segmented, LOAD_ICON, Empty
} from '../../components/ui/index.jsx'
import { Sparkline } from '../../components/charts/TimeSeries.jsx'
import { liveElectrical } from '../../lib/views.js'
import { CoverageMeter } from '../../components/charts/Bars.jsx'

const ASSIGNMENT_OPTIONS = [
  ...TENANTS.map((t) => ({ value: `tenant:${t.id}`, label: `${t.name} (private)` })),
  { value: 'communal', label: 'Communal — split between all participants' },
  { value: 'master', label: 'Master metering — reference only, not billed' }
]

export function assignmentLabel (assignment) {
  return ASSIGNMENT_OPTIONS.find((o) => o.value === assignment)?.label ?? assignment
}

function assignmentColor (assignment) {
  if (assignment === 'communal') return communalColor()
  if (assignment === 'master') return 'var(--text-muted)'
  return participantColor(assignment.replace('tenant:', ''))
}

export default function OwnerDevices () {
  const { telemetry, allocation, state, session, nowMs, alerts, store } = useApp()
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null)

  const last = telemetry.hours.length - 1
  const readOnly = session.role !== 'owner'
  const electrical = useMemo(() => liveElectrical(telemetry), [telemetry])

  const rows = useMemo(() => {
    return DEVICES.map((dv) => {
      const s = telemetry.series[dv.id]
      const alloc = dv.id === MASTER_ID
        ? { kwh: allocation.reconciliation.masterKwh, coverage: 1, corrections: [], atRiskKwh: 0, frozenHours: 0, gapHours: 0, closingRead: s.cum[last] }
        : allocation.devices.find((d) => d.deviceId === dv.id)
      const online = !!s.ok[last]
      let lastSeen = last
      while (lastSeen > 0 && !s.ok[lastSeen]) lastSeen--
      // A short daily profile for the row sparkline.
      const spark = []
      for (let i = Math.max(0, last - 47); i <= last; i++) spark.push(s.ok[i] ? s.kw[i] : 0)
      return {
        dv,
        alloc,
        online,
        lastSeenMs: Math.min(nowMs, telemetry.hours[lastSeen] + 3600_000),
        liveKw: online ? s.kw[last] : null,
        cum: s.cum[last],
        spark,
        assignment: state.assignments[dv.id] ?? dv.assignment
      }
    })
  }, [telemetry, allocation, state.assignments, last, nowMs])

  const filtered = rows.filter((r) => {
    if (filter === 'all') return true
    if (filter === 'issues') return !r.online || r.alloc.coverage < 0.995 || r.alloc.corrections.length > 0
    if (filter === 'communal') return r.assignment === 'communal'
    if (filter === 'private') return r.assignment.startsWith('tenant:')
    return true
  })

  const offlineCount = rows.filter((r) => !r.online).length

  return (
    <div className="grid" style={{ gap: 14 }}>
      {offlineCount > 0 && (
        <Notice tone={offlineCount > 1 ? 'bad' : 'warn'} icon="wifiOff"
          title={`${offlineCount} meter${offlineCount > 1 ? 's are' : ' is'} offline`}>
          Energy is still flowing through those circuits and through the master
          meter — it is simply not being attributed, so it lands on the main
          tenant’s residual. Restore them before issuing statements.
        </Notice>
      )}

      <Card
        title={`Meters (${filtered.length} of ${rows.length})`}
        subtitle="Live power, cumulative energy and this period's contribution."
        action={
          <Segmented label="Filter" value={filter} onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'issues', label: 'Needs attention' },
              { value: 'private', label: 'Private' },
              { value: 'communal', label: 'Communal' }
            ]} />
        }
      >
        {filtered.length === 0
          ? <Empty icon="check" title="Nothing matches that filter" />
          : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Meter</th>
                    <th>Assignment</th>
                    <th>Last reading</th>
                    <th className="n">Now</th>
                    <th className="n">V / A</th>
                    <th>48 h</th>
                    <th className="n">Period kWh</th>
                    <th className="n">Coverage</th>
                    <th className="n">Cumulative</th>
                    {!readOnly && <th />}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.dv.id}>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <Icon name={LOAD_ICON[r.dv.loadType]} size={15}
                            style={{ color: loadTypeColor(r.dv.loadType) }} />
                          <span>
                            <span style={{ display: 'block', fontWeight: 550 }}>{r.dv.name}</span>
                            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)' }}>
                              {r.dv.model} · {AREA_BY_ID[r.dv.area]?.name} · {r.dv.ip}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className="swatch" style={{ background: assignmentColor(r.assignment) }} />
                        {assignmentLabel(r.assignment).replace(/ \(private\)| — .*/, '')}
                      </td>
                      <td>
                        {r.online
                          ? <Badge tone="good" icon="wifi">{ago(r.lastSeenMs, nowMs)}</Badge>
                          : <Badge tone="bad" icon="wifiOff">{ago(r.lastSeenMs, nowMs)}</Badge>}
                        {r.alloc.corrections.length > 0 && (
                          <span style={{ marginLeft: 6 }}><Badge tone="warn" icon="alert">Reset</Badge></span>
                        )}
                      </td>
                      <td className="n">{r.liveKw == null ? '—' : `${kw(r.liveKw)} kW`}</td>
                      <td className="n" style={{ color: 'var(--text-secondary)' }}>
                        {r.dv.id === MASTER_ID
                          ? `${electrical.phases.map((p) => p.amps.toFixed(1)).join(' / ')} A`
                          : electrical.devices[r.dv.id]?.online
                            ? <>
                                {electrical.devices[r.dv.id].volts.toFixed(1)} V
                                <span style={{ color: 'var(--text-muted)' }}> · </span>
                                {electrical.devices[r.dv.id].amps.toFixed(2)} A
                              </>
                            : '—'}
                      </td>
                      <td>
                        <Sparkline values={r.spark} color={loadTypeColor(r.dv.loadType)} />
                      </td>
                      <td className="n">{kwh(r.alloc.kwh, 1)}</td>
                      <td className="n" style={{ minWidth: 90 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'flex-end' }}>
                          <CoverageMeter value={r.alloc.coverage} />
                          <span style={{ minWidth: 42 }}>{pct(r.alloc.coverage, 1)}</span>
                        </div>
                      </td>
                      <td className="n" style={{ color: 'var(--text-muted)' }}>{kwh(r.cum, 1)}</td>
                      {!readOnly && (
                        <td>
                          {r.dv.id !== MASTER_ID && (
                            <button className="btn sm" onClick={() => setEditing(r)}>Assign</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
      </Card>

      <Card title="Device notices" subtitle="Everything the data-quality checks found this period.">
        {alerts.filter((a) => a.deviceId).length === 0
          ? <Notice tone="good" icon="check">No device is reporting a problem.</Notice>
          : (
            <div style={{ display: 'grid', gap: 10 }}>
              {alerts.filter((a) => a.deviceId).map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                  <Badge tone={severityTone(a.severity)} icon={a.severity === 'info' ? 'info' : 'alert'}>{a.severity}</Badge>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.body}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      <Icon name="chevron" size={11} /> {a.action}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
      </Card>

      {editing && (
        <AssignModal row={editing} onClose={() => setEditing(null)}
          onSave={(value) => {
            store.setAssignment(editing.dv, value, session.role, assignmentLabel(value))
            setEditing(null)
          }} />
      )}
    </div>
  )
}

function AssignModal ({ row, onClose, onSave }) {
  const [value, setValue] = useState(row.assignment)
  const changed = value !== row.assignment
  return (
    <Modal title={`Assign ${row.dv.name}`} onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!changed} onClick={() => onSave(value)}>
            Save assignment
          </button>
        </>
      }>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Billed to"
          hint="Changing this recalculates every open period immediately. Statements already issued keep the assignment they were issued under.">
          <select value={value} onChange={(e) => setValue(e.target.value)}>
            {ASSIGNMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <div><strong>{row.dv.model}</strong> · {row.dv.mac} · firmware {row.dv.firmware}</div>
          <div>Commissioned {row.dv.commissionedAt} · {kwh(row.alloc.kwh, 1)} kWh this period</div>
          {row.dv.note && <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>{row.dv.note}</div>}
        </div>

        {changed && value === 'master' && (
          <Notice tone="warn" icon="alert">
            Marking this endpoint <strong>reference only</strong> removes its
            {' '}{kwh(row.alloc.kwh, 1)} kWh from every participant’s bill. Because the
            energy still passes the master meter, it moves straight into the main
            tenant’s residual. Use this for a check meter measuring a circuit that
            is already counted elsewhere — never to exclude a real load.
          </Notice>
        )}

        {changed && value !== 'master' && (
          <Notice tone="warn" icon="alert">
            This moves {kwh(row.alloc.kwh, 1)} kWh out of{' '}
            <strong>{assignmentLabel(row.assignment).replace(/ \(private\)| — .*/, '')}</strong> and into{' '}
            <strong>{assignmentLabel(value).replace(/ \(private\)| — .*/, '')}</strong> for the current period.
            The change is recorded in the audit trail.
          </Notice>
        )}
      </div>
    </Modal>
  )
}
