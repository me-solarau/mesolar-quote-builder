import { useState, useMemo } from 'react'

import { useApp } from '../../lib/useApp.jsx'
import { TENANTS, AREA_BY_ID } from '../../data/site.js'
import { participantColor } from '../../lib/palette.js'
import { kwh, money, pct, signedPct, date, fullDateTime, duration } from '../../lib/format.js'
import { Card, Badge, Icon, Segmented, Notice, Empty } from '../../components/ui/index.jsx'

const ACTION_LABEL = {
  'device.commissioned': 'Commissioning',
  'device.reassigned': 'Assignment',
  'split_rule.set': 'Split rule',
  'split_rule.updated': 'Split rule',
  'bill.entered': 'Bill',
  'bill.updated': 'Bill',
  'statement.issued': 'Statement',
  'reconciliation.override': 'Override',
  'reconciliation.override_cleared': 'Override',
  'meter.reset_detected': 'Data quality'
}

const ACTION_TONE = {
  'reconciliation.override': 'bad',
  'meter.reset_detected': 'warn',
  'statement.issued': 'good'
}

export default function OwnerReports () {
  const [tab, setTab] = useState('period')

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div>
        <Segmented label="Report" value={tab} onChange={setTab}
          options={[
            { value: 'period', label: 'Period report' },
            { value: 'exceptions', label: 'Exceptions' },
            { value: 'audit', label: 'Audit log' }
          ]} />
      </div>

      {tab === 'period' && <PeriodReport />}
      {tab === 'exceptions' && <Exceptions />}
      {tab === 'audit' && <AuditLog />}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function PeriodReport () {
  const { allocation, period, periodId, currentPeriodId, state, splitRule, site } = useApp()
  const rec = allocation.reconciliation
  const bill = state.bills.find((b) => b.periodId === periodId)

  const csv = useMemo(() => buildCsv({ allocation, period, splitRule, bill }), [allocation, period, splitRule, bill])

  return (
    <>
      <Card title={`Period report — ${period.label}`}
        subtitle={`${date(period.startMs)} to ${date(period.endMs)}${periodId === currentPeriodId ? ' (period still open)' : ''}`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => downloadCsv(csv, `powershare-${periodId}.csv`)}>
              <Icon name="download" size={14} /> CSV
            </button>
            <button className="btn no-print" onClick={() => window.print()}>
              <Icon name="print" size={14} /> Print
            </button>
          </div>
        }>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Participant</th>
                <th className="n">Own meters</th>
                <th className="n">Residual</th>
                <th className="n">Direct total</th>
                <th className="n">Communal %</th>
                <th className="n">Communal kWh</th>
                <th className="n">Allocated kWh</th>
                <th className="n">% of site</th>
                <th className="n">Allocated cost</th>
              </tr>
            </thead>
            <tbody>
              {TENANTS.map((t) => {
                const x = allocation.perTenant[t.id]
                return (
                  <tr key={t.id}>
                    <td><span className="swatch" style={{ background: participantColor(t.id) }} />{t.name}</td>
                    <td className="n">{kwh(x.privateMeteredKwh, 1)}</td>
                    <td className="n">{x.residualKwh > 0 ? kwh(x.residualKwh, 1) : '—'}</td>
                    <td className="n">{kwh(x.directKwh, 1)}</td>
                    <td className="n">{pct(x.communalSharePct, 0)}</td>
                    <td className="n">{kwh(x.communalShareKwh, 1)}</td>
                    <td className="n">{kwh(x.allocatedKwh, 1)}</td>
                    <td className="n">{pct(x.sharePct)}</td>
                    <td className="n">{bill ? money(x.cost) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Site total</td>
                <td className="n">{kwh(rec.privateKwh, 1)}</td>
                <td className="n">{kwh(rec.residualKwh, 1)}</td>
                <td className="n">{kwh(rec.privateKwh + rec.residualKwh, 1)}</td>
                <td className="n">100%</td>
                <td className="n">{kwh(allocation.communalKwh, 1)}</td>
                <td className="n">{kwh(rec.allocatedTotalKwh, 1)}</td>
                <td className="n">100.0%</td>
                <td className="n">{bill ? money(rec.costTotal) : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card title="Reconciliation summary">
        <div className="table-wrap">
          <table className="data">
            <tbody>
              <tr><td>Master 3-phase read</td><td className="n">{kwh(rec.masterKwh, 2)} kWh</td></tr>
              <tr><td>Explicitly metered endpoints</td><td className="n">{kwh(rec.meteredKwh, 2)} kWh</td></tr>
              <tr><td>Main-tenant residual</td><td className="n">{kwh(rec.residualKwh, 2)} kWh ({pct(rec.residualPct)})</td></tr>
              <tr><td>Allocated total</td><td className="n">{kwh(rec.allocatedTotalKwh, 2)} kWh</td></tr>
              <tr><td>Allocation variance against master</td><td className="n">{signedPct(rec.kwhReconciliationError, 4)}</td></tr>
              <tr><td>Unattributed during meter outages</td><td className="n">{kwh(rec.atRiskKwh, 2)} kWh ({pct(rec.atRiskPct, 2)})</td></tr>
              {bill && <tr><td>Retailer billed energy</td><td className="n">{kwh(bill.totalKwh, 0)} kWh ({signedPct(rec.billKwhVariance, 2)} vs master)</td></tr>}
              {bill && <tr><td>Distributable amount</td><td className="n">{money(bill.distributableAmount)}</td></tr>}
              <tr><td>Communal split rule</td><td className="n">{splitRule.name}</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12 }}>
          <Notice tone={rec.integrityBlocked ? 'bad' : 'good'} icon={rec.integrityBlocked ? 'alert' : 'check'}>
            {rec.integrityBlocked
              ? `Data completeness is below the ${pct(site.integrityThreshold, 1)} threshold for this period.`
              : `Allocation accounts for 100% of the master read, with ${pct(rec.atRiskPct, 2)} unattributed — inside the ${pct(site.integrityThreshold, 1)} threshold.`}
          </Notice>
        </div>
      </Card>

      <Card title="Every endpoint" subtitle="Opening and closing cumulative reads at the period boundaries.">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Area</th>
                <th>Assignment</th>
                <th className="n">Opening</th>
                <th className="n">Closing</th>
                <th className="n">Raw delta</th>
                <th className="n">Billed kWh</th>
                <th className="n">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {allocation.devices.map((d) => (
                <tr key={d.deviceId}>
                  <td>{d.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{AREA_BY_ID[d.area]?.name}</td>
                  <td>{assignmentName(d.assignment)}</td>
                  <td className="n" style={{ color: 'var(--text-muted)' }}>{kwh(d.openingRead, 1)}</td>
                  <td className="n" style={{ color: 'var(--text-muted)' }}>{kwh(d.closingRead, 1)}</td>
                  <td className="n" style={{ color: d.rawKwh < 0 ? 'var(--critical-text)' : undefined }}>
                    {kwh(d.rawKwh, 1)}
                  </td>
                  <td className="n">
                    {kwh(d.kwh, 1)}
                    {d.corrections.length > 0 && <Icon name="alert" size={12} style={{ marginLeft: 5, color: 'var(--warning)' }} />}
                  </td>
                  <td className="n">{pct(d.coverage, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ */

function Exceptions () {
  const { allocations, periods, state } = useApp()

  const rows = []
  for (const p of periods) {
    const a = allocations[p.id]
    for (const d of a.devices) {
      for (const c of d.corrections) {
        rows.push({
          period: p, device: d, kind: 'Counter reset',
          detail: `Counter dropped ${kwh(c.lostRawKwh, 1)} kWh mid-period. Raw end-minus-start delta ${kwh(d.rawKwh, 1)} kWh was unusable; rebuilt from the forward steps as ${kwh(d.kwh, 1)} kWh.`,
          tone: 'warn'
        })
      }
      if (d.frozenHours > 0) {
        rows.push({
          period: p, device: d, kind: 'Frozen counter',
          detail: `${duration(d.frozenHours)} with no reporting. Approximately ${kwh(d.atRiskKwh, 1)} kWh unattributed, absorbed by the main-tenant residual.`,
          tone: d.atRiskKwh > 10 ? 'bad' : 'warn'
        })
      } else if (d.gapHours > 0) {
        rows.push({
          period: p, device: d, kind: 'Reporting gap',
          detail: `${duration(d.gapHours)} of missing samples. The cumulative counter caught up on reconnect — no energy lost from the calculation.`,
          tone: 'neutral'
        })
      }
    }
    const o = state.overrides.find((x) => x.periodId === p.id)
    if (o) {
      rows.push({
        period: p, device: null, kind: 'Integrity override',
        detail: `${o.by} accepted ${kwh(a.reconciliation.atRiskKwh, 1)} kWh of unattributed energy: “${o.reason}”`,
        tone: 'bad'
      })
    }
  }

  if (rows.length === 0) {
    return <Card><Empty icon="check" title="No exceptions">
      Every meter reported continuously and no counter reset was detected.
    </Empty></Card>
  }

  return (
    <Card title={`Exceptions (${rows.length})`}
      subtitle="Everything that needed a correction, an estimate or a judgement call.">
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Period</th>
              <th>Kind</th>
              <th>Endpoint</th>
              <th style={{ whiteSpace: 'normal', minWidth: 380 }}>What happened</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.period.label}</td>
                <td><Badge tone={r.tone} icon={r.tone === 'neutral' ? 'info' : 'alert'}>{r.kind}</Badge></td>
                <td>{r.device?.name ?? '—'}</td>
                <td style={{ whiteSpace: 'normal' }}>{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

function AuditLog () {
  const { store } = useApp()
  const entries = store.auditTrail()

  return (
    <Card title={`Audit trail (${entries.length})`}
      subtitle="Append-only. Device assignments, split-rule changes, bill entries, statements, corrections and overrides.">
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Type</th>
              <th style={{ whiteSpace: 'normal', minWidth: 420 }}>Event</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td style={{ color: 'var(--text-muted)' }}>{fullDateTime(e.tsMs)}</td>
                <td>{e.actor}</td>
                <td>
                  <Badge tone={ACTION_TONE[e.action] ?? 'neutral'}
                    icon={ACTION_TONE[e.action] === 'good' ? 'check' : ACTION_TONE[e.action] ? 'alert' : 'info'}>
                    {ACTION_LABEL[e.action] ?? e.action}
                  </Badge>
                </td>
                <td style={{ whiteSpace: 'normal' }}>
                  <div style={{ fontWeight: 550 }}>{e.summary}</div>
                  {e.detail && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.detail}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */

/** Human-readable assignment, rather than the raw key stored on the device. */
function assignmentName (assignment) {
  if (assignment === 'communal') return 'Communal'
  if (assignment === 'master') return 'Master metering'
  return TENANTS.find((t) => `tenant:${t.id}` === assignment)?.name ?? assignment
}

function buildCsv ({ allocation, period, splitRule, bill }) {
  const rec = allocation.reconciliation
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    ['PowerShare period report'],
    ['Period', period.label],
    ['Start', new Date(period.startMs).toISOString()],
    ['End', new Date(period.endMs).toISOString()],
    ['Master kWh', rec.masterKwh.toFixed(3)],
    ['Communal kWh', allocation.communalKwh.toFixed(3)],
    ['Residual kWh', rec.residualKwh.toFixed(3)],
    ['Unattributed kWh', rec.atRiskKwh.toFixed(3)],
    ['Split rule', splitRule.name],
    ['Retailer', bill?.retailer ?? ''],
    ['Invoice', bill?.invoiceNo ?? ''],
    ['Distributable amount', bill?.distributableAmount ?? ''],
    [],
    ['Participant', 'Own meters kWh', 'Residual kWh', 'Direct kWh', 'Communal share %', 'Communal kWh', 'Allocated kWh', 'Share of site %', 'Allocated cost']
  ]
  for (const t of TENANTS) {
    const x = allocation.perTenant[t.id]
    lines.push([
      t.name, x.privateMeteredKwh.toFixed(3), x.residualKwh.toFixed(3), x.directKwh.toFixed(3),
      (x.communalSharePct * 100).toFixed(2), x.communalShareKwh.toFixed(3),
      x.allocatedKwh.toFixed(3), (x.sharePct * 100).toFixed(3), x.cost.toFixed(2)
    ])
  }
  lines.push([])
  lines.push(['Endpoint', 'Area', 'Assignment', 'Opening read', 'Closing read', 'Raw delta', 'Billed kWh', 'Coverage %', 'Corrections'])
  for (const d of allocation.devices) {
    lines.push([
      d.name, AREA_BY_ID[d.area]?.name ?? d.area, assignmentName(d.assignment),
      d.openingRead.toFixed(3), d.closingRead.toFixed(3), d.rawKwh.toFixed(3),
      d.kwh.toFixed(3), (d.coverage * 100).toFixed(2), d.corrections.length
    ])
  }
  return lines.map((r) => r.map(esc).join(',')).join('\n')
}

function downloadCsv (csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
