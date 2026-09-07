import { useState } from 'react'

import { useApp, useRoute } from '../../lib/useApp.jsx'
import { TENANTS, TENANT_BY_ID } from '../../data/site.js'
import { participantColor, communalColor } from '../../lib/palette.js'
import { kwh, money, pct } from '../../lib/format.js'
import { deviceRowsFor, participantDaily } from '../../lib/views.js'
import { Card, Stat, Delta, Badge, Avatar, Icon, Segmented, Notice, LOAD_ICON } from '../../components/ui/index.jsx'
import { BarList, GroupedBars } from '../../components/charts/Bars.jsx'
import { StackedArea } from '../../components/charts/TimeSeries.jsx'
import { ChartTable } from '../../components/charts/primitives.jsx'

export default function OwnerTenants () {
  const {
    telemetry, allocation, allocations, periods, period, periodId, currentPeriodId,
    state, splitRule, estimateRate
  } = useApp()
  const [selected, setSelected] = useState(null)
  const [view, setView] = useState('chart')

  const isOpen = periodId === currentPeriodId
  const idx = periods.findIndex((p) => p.id === periodId)
  const prev = idx > 0 ? allocations[periods[idx - 1].id] : null
  const rec = allocation.reconciliation

  const rows = TENANTS.map((t) => {
    const x = allocation.perTenant[t.id]
    const p = prev?.perTenant[t.id]
    return {
      tenant: t,
      x,
      delta: p && p.allocatedKwh > 0 ? (x.allocatedKwh - p.allocatedKwh) / p.allocatedKwh : null,
      cost: isOpen ? x.allocatedKwh * estimateRate : x.cost,
      estimated: isOpen
    }
  })

  const detail = selected ? rows.find((r) => r.tenant.id === selected) : null

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid cols-4">
        {rows.map((r) => (
          <Card key={r.tenant.id} className="tenant-card"
            style={{ cursor: 'pointer', borderColor: selected === r.tenant.id ? participantColor(r.tenant.id) : undefined }}
            onClick={() => setSelected(selected === r.tenant.id ? null : r.tenant.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
              <Avatar name={r.tenant.name} color={participantColor(r.tenant.id)} size={26} />
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.tenant.shortName}</div>
              {r.tenant.isResidual && <Badge tone="info">Residual</Badge>}
            </div>
            <Stat label="Allocated" value={kwh(r.x.allocatedKwh, 0)} unit=" kWh"
              delta={r.delta != null ? <Delta value={r.delta} /> : null}
              sub={`${pct(r.x.sharePct)} · ${money(r.cost)}${isOpen ? ' est.' : ''}`} />
            <div style={{ marginTop: 10, display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', gap: 2, background: 'var(--surface-2)' }}>
              <div style={{ flex: `${Math.max(0.001, r.x.directKwh)} 0 0`, background: participantColor(r.tenant.id) }} />
              <div style={{ flex: `${Math.max(0.001, r.x.communalShareKwh)} 0 0`, background: communalColor() }} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>
              {kwh(r.x.directKwh, 0)} direct · {kwh(r.x.communalShareKwh, 0)} communal
            </div>
          </Card>
        ))}
      </div>

      <Card title="Allocation for this period"
        subtitle={`${splitRule.name} · master read ${kwh(rec.masterKwh, 1)} kWh · distributable ${isOpen ? 'not yet billed' : money(rec.distributable)}`}
        action={<Segmented label="View" value={view} onChange={setView}
          options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} />}>
        {view === 'chart'
          ? (
            <>
              <BarList
                items={rows.map((r) => ({
                  key: r.tenant.id,
                  label: r.tenant.shortName,
                  value: r.x.allocatedKwh,
                  color: participantColor(r.tenant.id)
                }))}
                height={30}
              />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                Bars are allocated energy — each participant’s own meters plus their
                share of communal. They sum to the master read.
              </div>
            </>
            )
          : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th className="n">Own meters</th>
                    <th className="n">Residual</th>
                    <th className="n">Communal share</th>
                    <th className="n">Allocated</th>
                    <th className="n">% of site</th>
                    <th className="n">{isOpen ? 'Est. cost' : 'Cost'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.tenant.id}>
                      <td>
                        <span className="swatch" style={{ background: participantColor(r.tenant.id) }} />
                        {r.tenant.name}
                      </td>
                      <td className="n">{kwh(r.x.privateMeteredKwh, 1)}</td>
                      <td className="n">{r.x.residualKwh > 0 ? kwh(r.x.residualKwh, 1) : '—'}</td>
                      <td className="n">{kwh(r.x.communalShareKwh, 1)}</td>
                      <td className="n">{kwh(r.x.allocatedKwh, 1)}</td>
                      <td className="n">{pct(r.x.sharePct)}</td>
                      <td className="n">{money(r.cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="n">{kwh(rec.privateKwh, 1)}</td>
                    <td className="n">{kwh(rec.residualKwh, 1)}</td>
                    <td className="n">{kwh(allocation.communalKwh, 1)}</td>
                    <td className="n">{kwh(rec.allocatedTotalKwh, 1)}</td>
                    <td className="n">100.0%</td>
                    <td className="n">{money(rows.reduce((a, r) => a + r.cost, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            )}
      </Card>

      {detail && <TenantDetail row={detail} />}

      <Card title="Trend across every period" subtitle="Allocated energy per participant.">
        <GroupedBars
          height={240}
          groups={periods.map((p) => ({
            key: p.id,
            label: p.label.replace(' 2026', ''),
            subLabel: p.id === currentPeriodId ? 'open' : undefined,
            values: Object.fromEntries(
              TENANTS.map((t) => [t.id, allocations[p.id].perTenant[t.id].allocatedKwh])
            )
          }))}
          series={TENANTS.map((t) => ({
            key: t.id, label: t.shortName, color: participantColor(t.id)
          }))}
        />
        <div className="legend" style={{ marginTop: 12 }}>
          {TENANTS.map((t) => (
            <span className="legend-item" key={t.id}>
              <span className="legend-swatch" style={{ background: participantColor(t.id) }} />{t.shortName}
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}

function TenantDetail ({ row }) {
  const { telemetry, allocation, state, period } = useApp()
  const t = row.tenant
  const colour = participantColor(t.id)
  const devices = deviceRowsFor(allocation, t.id, state.assignments)
  const daily = participantDaily(telemetry, allocation, t.id, state.assignments, allocation.splitShares[t.id])

  return (
    <Card title={`${t.name} — detail`} subtitle={t.note || `${devices.length} assigned endpoints`}>
      <div className="grid side">
        <div>
          <StackedArea
            data={daily}
            height={210}
            series={[
              { key: 'direct', label: t.isResidual ? 'Direct (residual)' : 'Own meters', color: colour },
              { key: 'communal', label: 'Communal share', color: communalColor() }
            ]}
          />
          <div className="legend" style={{ marginTop: 10 }}>
            <span className="legend-item"><span className="legend-swatch" style={{ background: colour }} />
              {t.isResidual ? 'Direct (residual)' : 'Own meters'}</span>
            <span className="legend-item"><span className="legend-swatch" style={{ background: communalColor() }} />Communal share</span>
          </div>
        </div>
        <div>
          {devices.length === 0
            ? <Notice icon="info">No assigned endpoints — this participant is charged the residual.</Notice>
            : (
              <BarList
                items={devices.map((d) => ({
                  key: d.deviceId, label: d.device.name, value: d.kwh, color: colour
                }))}
                height={22}
              />
              )}
        </div>
      </div>
    </Card>
  )
}
