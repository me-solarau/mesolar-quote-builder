import { useState, useMemo } from 'react'

import { useApp } from '../../lib/useApp.jsx'
import { DEVICES, DEVICE_BY_ID, MASTER_ID, AREA_BY_ID, TENANTS } from '../../data/site.js'
import { loadTypeColor, participantColor, communalColor } from '../../lib/palette.js'
import { kwh, kw, pct, ago, signedPct } from '../../lib/format.js'
import { Card, Badge, Icon, Notice, Field, LOAD_ICON, Segmented, Modal } from '../../components/ui/index.jsx'
import { CoverageMeter } from '../../components/charts/Bars.jsx'
import { assignmentLabel } from '../owner/Devices.jsx'

/**
 * Installer view (FR-01/FR-02). Onboarding, assignment and — the part that
 * actually matters on site — verifying that the sum of the submeters tracks the
 * master before anyone is billed from it.
 */
export default function InstallerCommissioning () {
  const { telemetry, allocation, state, session, nowMs, store, site } = useApp()
  const [adding, setAdding] = useState(false)

  const last = telemetry.hours.length - 1
  const liveMaster = telemetry.series[MASTER_ID].kw[last]

  const rows = DEVICES.filter((d) => d.id !== MASTER_ID).map((dv) => {
    const s = telemetry.series[dv.id]
    const online = !!s.ok[last]
    let lastSeen = last
    while (lastSeen > 0 && !s.ok[lastSeen]) lastSeen--
    const alloc = allocation.devices.find((d) => d.deviceId === dv.id)
    return { dv, online, lastSeenMs: telemetry.hours[lastSeen], liveKw: online ? s.kw[last] : null, alloc }
  })

  const liveMetered = rows.reduce((a, r) => a + (r.liveKw ?? 0), 0)
  const liveResidual = Math.max(0, liveMaster - liveMetered)
  const commissioned = rows.filter((r) => r.online).length
  const rec = allocation.reconciliation

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card title="Commissioning status"
        subtitle="Every meter must report before the site can be billed from this data."
        action={<button className="btn primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={14} /> Onboard a meter
        </button>}>
        <div className="grid cols-4">
          <Tile label="Meters onboarded" value={`${DEVICES.length}`} sub="16 × 1PM, 1 × EM, 1 × Pro 3EM" />
          <Tile label="Reporting now" value={`${commissioned + 1} / ${DEVICES.length}`}
            tone={commissioned + 1 === DEVICES.length ? 'good' : 'bad'}
            sub={commissioned + 1 === DEVICES.length ? 'all endpoints live' : `${DEVICES.length - commissioned - 1} not reporting`} />
          <Tile label="Live master" value={`${kw(liveMaster)} kW`}
            sub={`${kw(liveMetered)} kW measured · ${kw(liveResidual)} kW residual`} />
          <Tile label="Period coverage" value={pct(1 - rec.atRiskPct, 2)}
            tone={rec.integrityBlocked ? 'bad' : 'good'}
            sub={`${kwh(rec.atRiskKwh, 1)} kWh unattributed`} />
        </div>
      </Card>

      <Card title="Live verification"
        subtitle="Submeter sum against the master right now. On a healthy site the gap is the main tenant's unmetered business load, and nothing else.">
        <div style={{ display: 'grid', gap: 10 }}>
          <VerifyRow label="Master 3-phase (Pro 3EM)" value={`${kw(liveMaster)} kW`} strong />
          <VerifyRow label="Sum of all submeters" value={`${kw(liveMetered)} kW`} />
          <VerifyRow label="Unmetered residual" value={`${kw(liveResidual)} kW`}
            note={`${pct(liveResidual / Math.max(0.001, liveMaster))} of live demand — cool rooms and back-of-house`} />
        </div>
        <div style={{ marginTop: 14 }}>
          {rows.some((r) => !r.online)
            ? (
              <Notice tone="bad" icon="wifiOff" title="Commissioning is not complete">
                {rows.filter((r) => !r.online).map((r) => r.dv.name).join(', ')}
                {' '}not reporting. Until every endpoint is live, the residual absorbs
                their load and the main tenant is overcharged.
              </Notice>
              )
            : (
              <Notice tone="good" icon="check">
                Every endpoint is reporting. The residual is within the expected
                {' '}{pct(site.residualExpectedMin, 0)}–{pct(site.residualExpectedMax, 0)} band.
              </Notice>
              )}
        </div>
      </Card>

      <Card title="Endpoints" subtitle="Assignment and load type are set here at commissioning.">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Meter</th>
                <th>Model</th>
                <th>Location</th>
                <th>Assignment</th>
                <th>State</th>
                <th className="n">Live</th>
                <th className="n">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.dv.id}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Icon name={LOAD_ICON[r.dv.loadType]} size={15} style={{ color: loadTypeColor(r.dv.loadType) }} />
                      <span>
                        <span style={{ display: 'block', fontWeight: 550 }}>{r.dv.name}</span>
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {r.dv.mac} · {r.dv.ip} · fw {r.dv.firmware}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {r.dv.model}
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {r.dv.metering === 'ct' ? `CT, ${r.dv.maxAmps} A` : `Relay, ${r.dv.maxAmps} A max`}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{AREA_BY_ID[r.dv.area]?.name}</td>
                  <td>{assignmentLabel(state.assignments[r.dv.id] ?? r.dv.assignment).replace(/ \(private\)| — .*/, '')}</td>
                  <td>
                    {r.online
                      ? <Badge tone="good" icon="wifi">Online</Badge>
                      : <Badge tone="bad" icon="wifiOff">{ago(r.lastSeenMs, nowMs)}</Badge>}
                  </td>
                  <td className="n">{r.liveKw == null ? '—' : `${kw(r.liveKw)} kW`}</td>
                  <td className="n" style={{ color: 'var(--text-muted)' }}>
                    {kwh(telemetry.series[r.dv.id].cum[last], 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Installation notes" subtitle="Carried from the electrical design in the PRD.">
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', display: 'grid', gap: 7 }}>
          <li>All 230/400 V work is by a licensed electrician, in a compliant enclosure.</li>
          <li>The 32 A stove/oven is CT-metered on a Shelly EM Gen3 — the load never passes through a 16 A relay.</li>
          <li>Both air conditioners use a 1PM Gen3 only because their nameplate and inrush were verified on site. An unsuitable unit becomes a CT-metering variation.</li>
          <li>The Pro 3EM sits on L1/L2/L3 of the 3-phase 50 A supply and is the reconciliation reference for every billing period.</li>
          <li>Wired Ethernet to the gateway and the Pro 3EM where practical; validate Wi-Fi coverage at every in-wall meter before sign-off.</li>
          <li>Relay control is not exposed to any app role — these devices are read-only from PowerShare.</li>
        </ul>
      </Card>

      {adding && <OnboardModal onClose={() => setAdding(false)} />}
    </div>
  )
}

function Tile ({ label, value, sub, tone }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value num" style={{
        color: tone === 'bad' ? 'var(--critical-text)' : tone === 'good' ? 'var(--good-text)' : undefined
      }}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  )
}

function VerifyRow ({ label, value, note, strong }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: strong ? 600 : 400 }}>{label}</span>
        {note && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{note}</div>}
      </div>
      <div className="num" style={{ fontWeight: strong ? 650 : 550, fontSize: strong ? 17 : 15 }}>{value}</div>
    </div>
  )
}

function OnboardModal ({ onClose }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ ip: '', name: '', area: 'kitchen', loadType: 'gpo', assignment: 'communal' })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Modal wide title="Onboard a meter" onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled onClick={onClose}>Add meter</button>
        </>
      }>
      <Notice icon="info" title="Not wired up in this build">
        Device discovery talks to Home Assistant, which is not running behind this
        demo. The form below is the real onboarding shape — discovery by IP or
        mDNS, then naming, location, load type and assignment — and
        <code> docs/home-assistant/</code> has the gateway configuration it would
        talk to.
      </Notice>

      <div className="grid cols-2" style={{ gap: 12, marginTop: 14 }}>
        <Field label="Device IP or mDNS name" hint="e.g. 192.168.10.42 or shelly1pm-a4cf12.local">
          <input type="text" value={form.ip} onChange={(e) => set('ip', e.target.value)} placeholder="192.168.10." />
        </Field>
        <Field label="Meter name">
          <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Laundry GPO" />
        </Field>
        <Field label="Location">
          <select value={form.area} onChange={(e) => set('area', e.target.value)}>
            {Object.values(AREA_BY_ID).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Load type">
          <select value={form.loadType} onChange={(e) => set('loadType', e.target.value)}>
            <option value="gpo">GPO / power points</option>
            <option value="light">Lighting</option>
            <option value="ac">Air conditioning</option>
            <option value="cooking">Cooking</option>
          </select>
        </Field>
        <Field label="Billed to" hint="Determines whether this endpoint is private or pooled.">
          <select value={form.assignment} onChange={(e) => set('assignment', e.target.value)}>
            {TENANTS.map((t) => <option key={t.id} value={`tenant:${t.id}`}>{t.name} (private)</option>)}
            <option value="communal">Communal — split between all participants</option>
          </select>
        </Field>
      </div>
    </Modal>
  )
}
