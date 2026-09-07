import { useApp } from '../../lib/useApp.jsx'
import { TENANTS, MASTER_ID, DEVICE_BY_ID } from '../../data/site.js'
import { participantColor, communalColor, PARTICIPANT_ORDER } from '../../lib/palette.js'
import { kwh, kw, money, pct, signedPct, duration, date } from '../../lib/format.js'
import { dailyStacked, recentPower } from '../../lib/allocation.js'
import { devicesFor, communalDevices, periodDays, projectToEnd } from '../../lib/views.js'
import { severityTone } from '../../lib/alerts.js'
import { Card, Stat, Delta, Notice, Badge, Icon } from '../../components/ui/index.jsx'
import { StackedArea, PowerLine } from '../../components/charts/TimeSeries.jsx'
import { CompositionBar, BarList, CoverageMeter } from '../../components/charts/Bars.jsx'
import { useRoute } from '../../lib/useApp.jsx'

export default function OwnerDashboard () {
  const {
    telemetry, allocation, allocations, period, periodId, periods, currentPeriodId,
    alerts, site, state, nowMs, estimateRate
  } = useApp()
  const [, navigate] = useRoute()

  const rec = allocation.reconciliation
  const isOpen = periodId === currentPeriodId
  const idx = periods.findIndex((p) => p.id === periodId)
  const prev = idx > 0 ? allocations[periods[idx - 1].id] : null

  const last = telemetry.hours.length - 1
  const liveMaster = telemetry.series[MASTER_ID].kw[last]
  const power = recentPower(telemetry, MASTER_ID, 48)

  const { elapsed, total } = periodDays(period, nowMs)
  const projected = isOpen ? projectToEnd(rec.masterKwh, period, nowMs) : null

  const masterDelta = prev && prev.reconciliation.masterKwh > 0 && !isOpen
    ? (rec.masterKwh - prev.reconciliation.masterKwh) / prev.reconciliation.masterKwh
    : null

  // Daily stack: each participant's direct usage plus the communal pool.
  const groups = [
    ...PARTICIPANT_ORDER.filter((id) => id !== 'main').map((id) => ({
      key: id,
      deviceIds: devicesFor(id, state.assignments).map((d) => d.id)
    })),
    { key: 'communal', deviceIds: communalDevices(state.assignments).map((d) => d.id) },
    { key: 'main', deviceIds: devicesFor('main', state.assignments).map((d) => d.id), residual: true }
  ]
  const daily = dailyStacked(telemetry, groups, allocation.i0, allocation.i1)
  const stackSeries = [
    { key: 'bed1', label: 'Bedroom 1', color: participantColor('bed1') },
    { key: 'bed2', label: 'Bedroom 2', color: participantColor('bed2') },
    { key: 'armand', label: 'Armand', color: participantColor('armand') },
    { key: 'communal', label: 'Communal', color: communalColor() },
    { key: 'main', label: 'Main tenant (residual)', color: participantColor('main') }
  ]

  const offline = allocation.devices.filter((d) => telemetry.series[d.deviceId].ok[allocation.i1] === 0)
  const online = allocation.devices.length + 1 - offline.length

  return (
    <div className="grid" style={{ gap: 14 }}>
      {alerts.filter((a) => a.severity === 'critical').map((a) => (
        <Notice key={a.id} tone="bad" icon="alert" title={a.title}
          action={a.kind === 'integrity'
            ? <button className="btn sm" onClick={() => navigate('billing')}>Go to Billing</button>
            : <button className="btn sm" onClick={() => navigate('devices')}>Devices</button>}>
          {a.body} <em>{a.action}</em>
        </Notice>
      ))}

      <div className="grid cols-4">
        <Card>
          <Stat label="Site energy" value={kwh(rec.masterKwh, 0)} unit=" kWh"
            delta={masterDelta != null ? <Delta value={masterDelta} /> : null}
            sub={isOpen ? `day ${elapsed} of ${total}` : 'master 3-phase read'} />
        </Card>
        <Card>
          <Stat label="Live demand" value={kw(liveMaster, 2)} unit=" kW"
            sub={`${(liveMaster * 1000 / (3 * 230)).toFixed(1)} A avg per phase`} />
        </Card>
        <Card>
          <Stat label="Attributed to meters" value={pct(rec.meteredKwh / Math.max(1e-9, rec.masterKwh))}
            sub={`${kwh(rec.meteredKwh, 0)} kWh across ${allocation.devices.length} endpoints`} />
        </Card>
        <Card>
          <Stat label="Unattributed energy" value={kwh(rec.atRiskKwh, 1)} unit=" kWh"
            sub={rec.atRiskKwh > 0
              ? `${pct(rec.atRiskPct, 2)} of master — threshold ${pct(site.integrityThreshold, 1)}`
              : 'every endpoint reported in full'} />
          {rec.atRiskKwh > 0 && (
            <div style={{ marginTop: 8 }}>
              <CoverageMeter value={Math.min(1, rec.atRiskPct / (site.integrityThreshold * 2))}
                threshold={0.5} />
            </div>
          )}
        </Card>
      </div>

      <div className="grid side">
        <Card title="Where the site's energy went"
          subtitle={`${period.label} — every participant's direct usage plus the communal pool.`}>
          <CompositionBar
            total={rec.masterKwh}
            height={38}
            segments={[
              { key: 'bed1', label: 'Bedroom 1', value: allocation.perTenant.bed1.directKwh, color: participantColor('bed1') },
              { key: 'bed2', label: 'Bedroom 2', value: allocation.perTenant.bed2.directKwh, color: participantColor('bed2') },
              { key: 'armand', label: 'Armand', value: allocation.perTenant.armand.directKwh, color: participantColor('armand') },
              { key: 'communal', label: 'Communal', value: allocation.communalKwh, color: communalColor() },
              { key: 'main', label: 'Main tenant (residual)', value: allocation.mainDirectKwh, color: participantColor('main') }
            ]}
          />
        </Card>

        <Card title="Live site demand" subtitle={`Master meter, last 48 hours. Now: ${kw(liveMaster)} kW`}>
          <PowerLine data={power} color={participantColor('main')} height={150} label="Site demand" />
        </Card>
      </div>

      <Card title="Daily energy by participant"
        subtitle="Direct metered usage per participant, the communal pool, and the main tenant's residual — stacking to the master read.">
        <StackedArea data={daily} series={stackSeries} height={250} />
        <div className="legend" style={{ marginTop: 12 }}>
          {stackSeries.map((s) => (
            <span className="legend-item" key={s.key}>
              <span className="legend-swatch" style={{ background: s.color }} />{s.label}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid side">
        <Card title="Reconciliation" subtitle="Does the sum of the parts equal the master read?"
          action={<Badge tone={rec.integrityBlocked ? 'bad' : rec.residualWithinBand ? 'good' : 'warn'}
            icon={rec.integrityBlocked ? 'alert' : 'check'}>
            {rec.integrityBlocked ? 'Blocked' : rec.residualWithinBand ? 'Reconciled' : 'Check residual'}
          </Badge>}>
          <table className="data" style={{ marginTop: -4 }}>
            <tbody>
              <Row label="Master 3-phase read" value={`${kwh(rec.masterKwh, 1)} kWh`} strong />
              <Row label="Less private endpoints" value={`− ${kwh(rec.privateKwh, 1)} kWh`} />
              <Row label="Less communal endpoints" value={`− ${kwh(rec.communalKwh, 1)} kWh`} />
              <Row label="Main tenant residual" value={`${kwh(rec.residualKwh, 1)} kWh`} strong
                note={`${pct(rec.residualPct)} of master · expected ${pct(site.residualExpectedMin, 0)}–${pct(site.residualExpectedMax, 0)}`} />
              <Row label="Allocated total" value={`${kwh(rec.allocatedTotalKwh, 1)} kWh`}
                note={`variance ${signedPct(rec.kwhReconciliationError, 3)} against master`} />
              {rec.billKwhVariance != null && (
                <Row label="Retailer billed energy"
                  value={`${kwh(state.bills.find((b) => b.periodId === periodId)?.totalKwh ?? 0, 0)} kWh`}
                  note={`master differs by ${signedPct(rec.billKwhVariance, 2)}`} />
              )}
            </tbody>
          </table>
          <div style={{ marginTop: 12 }}>
            <Notice tone={rec.atRiskKwh > 0.5 ? 'warn' : 'good'} icon={rec.atRiskKwh > 0.5 ? 'alert' : 'check'}>
              {rec.atRiskKwh > 0.5
                ? <>{kwh(rec.atRiskKwh, 1)} kWh flowed through the master while a meter was
                    not reporting. That energy is currently sitting in the main tenant’s
                    residual, which is why the residual is {pct(rec.residualPct)} rather than
                    its usual level.</>
                : <>Every endpoint reported for the full period. The allocation accounts
                    for 100% of the master read.</>}
            </Notice>
          </div>
        </Card>

        <Card title="Alerts" subtitle={`${alerts.length} open · ${online} of ${allocation.devices.length + 1} meters online`}
          action={<button className="btn sm" onClick={() => navigate('devices')}>All devices</button>}>
          {alerts.length === 0
            ? <Notice tone="good" icon="check">Nothing needs attention.</Notice>
            : (
              <div style={{ display: 'grid', gap: 9 }}>
                {alerts.slice(0, 5).map((a) => (
                  <div key={a.id} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                    <Badge tone={severityTone(a.severity)} icon={a.severity === 'info' ? 'info' : 'alert'}>
                      {a.severity}
                    </Badge>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 550 }}>{a.title}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{a.body}</div>
                    </div>
                  </div>
                ))}
              </div>
              )}
        </Card>
      </div>
    </div>
  )
}

function Row ({ label, value, note, strong }) {
  return (
    <tr>
      <td style={{ whiteSpace: 'normal' }}>
        <span style={{ fontWeight: strong ? 600 : 400 }}>{label}</span>
        {note && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{note}</div>}
      </td>
      <td className="n" style={{ fontWeight: strong ? 600 : 400 }}>{value}</td>
    </tr>
  )
}
