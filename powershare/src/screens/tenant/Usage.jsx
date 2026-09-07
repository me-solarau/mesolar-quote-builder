import { useState } from 'react'

import { useApp } from '../../lib/useApp.jsx'
import RangePicker from '../../components/RangePicker.jsx'
import { TENANT_BY_ID, LOAD_TYPES } from '../../data/site.js'
import { participantColor, communalColor, loadTypeColor, LOAD_TYPE_ORDER } from '../../lib/palette.js'
import { kwh, pct, duration, dayMonth, time } from '../../lib/format.js'
import { deviceRowsFor, communalRows, byLoadType, participantDaily } from '../../lib/views.js'
import { Card, Segmented, Icon, Badge, LOAD_ICON, Notice } from '../../components/ui/index.jsx'
import { BarList, CompositionBar } from '../../components/charts/Bars.jsx'
import { StackedArea } from '../../components/charts/TimeSeries.jsx'
import { ChartTable } from '../../components/charts/primitives.jsx'

export default function TenantUsage () {
  const {
    session, telemetry, state, nowMs, earliestMs,
    rangeAllocation, range, rangeMode, setRangeMode, customRange, setCustomRange
  } = useApp()
  const [view, setView] = useState('chart')

  // Every figure on this screen follows the selected range, not the billing
  // period — a tenant asking "what did I use today" is not asking about money.
  const allocation = rangeAllocation

  const tid = session.tenantId
  const tenant = TENANT_BY_ID[tid]
  const colour = participantColor(tid)
  const me = allocation.perTenant[tid]

  const mine = deviceRowsFor(allocation, tid, state.assignments)
  const communal = communalRows(allocation, state.assignments)
  const share = allocation.splitShares[tid]

  const myTypes = byLoadType(mine)
  const communalTypes = byLoadType(communal)

  const hourly = range.granularity === 'hour'
  const daily = participantDaily(
    telemetry, allocation, tid, state.assignments, share, hourly ? 1 : 24
  )

  const typeSeries = LOAD_TYPE_ORDER
    .filter((t) => (myTypes[t] ?? 0) + (communalTypes[t] ?? 0) * share > 0)
    .map((t) => ({
      key: t,
      label: LOAD_TYPES[t].label,
      color: loadTypeColor(t),
      value: (myTypes[t] ?? 0) + (communalTypes[t] ?? 0) * share
    }))

  const offlineCommunal = communal.filter((r) => r.frozenHours > 0)

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <RangePicker mode={rangeMode} onMode={setRangeMode}
            custom={customRange} onCustom={setCustomRange}
            nowMs={nowMs} earliestMs={earliestMs} />
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            Showing <strong style={{ color: 'var(--text-secondary)' }}>{range.label}</strong>
            {' '}· {kwh(me.allocatedKwh, 1)} kWh allocated to you
          </div>
        </div>
      </Card>

      <Card
        title="What you used it on"
        subtitle={`${range.label} — your own meters plus your share of every communal endpoint, grouped by the kind of load.`}
        action={<Segmented label="View" value={view} onChange={setView}
          options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} />}
      >
        {view === 'chart'
          ? (
            <>
              <CompositionBar total={me.allocatedKwh} segments={typeSeries} height={38} />
              <div style={{ marginTop: 22 }}>
                <BarList items={typeSeries.map((s) => ({ ...s }))} />
              </div>
            </>
            )
          : (
            <ChartTable
              columns={[
                { key: 'label', label: 'Load type', swatch: 'color' },
                { key: 'kwh', label: 'kWh', numeric: true },
                { key: 'share', label: 'Share of your total', numeric: true }
              ]}
              rows={typeSeries.map((s) => ({
                label: s.label,
                color: s.color,
                kwh: kwh(s.value, 1),
                share: pct(s.value / Math.max(1e-9, me.allocatedKwh))
              }))}
            />
            )}
      </Card>

      <div className="grid cols-2 align-start">
        <Card title={tenant.isResidual ? 'Your metered endpoints' : 'Your own meters'}
          subtitle={`${kwh(me.privateMeteredKwh, 1)} kWh billed directly to you — ${range.label}.`}>
          {mine.length === 0
            ? (
              <Notice icon="info">
                You have no individually metered endpoints. Your usage is calculated
                as the residual — the master meter less every other participant’s
                measured usage.
              </Notice>
              )
            : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Endpoint</th>
                      <th>Area</th>
                      <th className="n">kWh</th>
                      <th className="n">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mine.map((r) => (
                      <tr key={r.deviceId}>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                            <Icon name={LOAD_ICON[r.device.loadType]} size={14} style={{ color: colour }} />
                            {r.device.name}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{r.areaName}</td>
                        <td className="n">{kwh(r.kwh, 1)}</td>
                        <td className="n">{pct(r.share, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>Total direct</td>
                      <td className="n">{kwh(me.directKwh, 1)}</td>
                      <td className="n">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              )}
        </Card>

        <Card title="Communal areas"
          subtitle={`${kwh(allocation.communalKwh, 1)} kWh shared · your share is ${pct(share, 0)}.`}>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th className="n">Total kWh</th>
                  <th className="n">Your share</th>
                </tr>
              </thead>
              <tbody>
                {communal.map((r) => (
                  <tr key={r.deviceId}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        <Icon name={LOAD_ICON[r.device.loadType]} size={14} style={{ color: communalColor() }} />
                        {r.device.name}
                      </span>
                      {r.frozenHours > 0 && (
                        <span style={{ marginLeft: 8 }}>
                          <Badge tone="warn" icon="wifiOff">{duration(r.frozenHours)} offline</Badge>
                        </span>
                      )}
                    </td>
                    <td className="n">{kwh(r.kwh, 1)}</td>
                    <td className="n">{kwh(r.kwh * share, 1)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Communal total</td>
                  <td className="n">{kwh(allocation.communalKwh, 1)}</td>
                  <td className="n">{kwh(me.communalShareKwh, 1)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {offlineCommunal.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Notice tone="warn" icon="alert">
                {offlineCommunal.length === 1 ? 'A communal meter is' : `${offlineCommunal.length} communal meters are`} offline,
                so the communal total above is understated. Your share will be
                recalculated once the meter is restored.
              </Notice>
            </div>
          )}
        </Card>
      </div>

      <Card title={hourly ? 'Hour by hour' : 'Day by day'}
        subtitle={`${range.label} — direct usage and communal share.`}>
        <StackedArea
          data={daily}
          height={240}
          xLabel={hourly ? time : dayMonth}
          series={[
            { key: 'direct', label: tenant.isResidual ? 'Direct (residual)' : 'Your meters', color: colour },
            { key: 'communal', label: 'Communal share', color: communalColor() }
          ]}
        />
        <div className="legend" style={{ marginTop: 10 }}>
          <span className="legend-item"><span className="legend-swatch" style={{ background: colour }} />
            {tenant.isResidual ? 'Direct (residual)' : 'Your meters'}</span>
          <span className="legend-item"><span className="legend-swatch" style={{ background: communalColor() }} />
            Communal share</span>
        </div>
      </Card>
    </div>
  )
}
