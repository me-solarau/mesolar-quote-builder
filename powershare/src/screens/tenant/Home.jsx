import { useApp } from '../../lib/useApp.jsx'
import { TENANT_BY_ID, LOAD_TYPES } from '../../data/site.js'
import { participantColor, communalColor } from '../../lib/palette.js'
import { kwh, kw, money, date, pct } from '../../lib/format.js'
import {
  devicesFor, liveKw, liveResidualKw, participantPower, participantDaily,
  periodDays, projectToEnd, deviceRowsFor
} from '../../lib/views.js'
import { Card, Stat, Delta, Notice, Badge, Icon, LOAD_ICON } from '../../components/ui/index.jsx'
import { PowerLine, StackedArea } from '../../components/charts/TimeSeries.jsx'
import { CompositionBar, BarList } from '../../components/charts/Bars.jsx'

export default function TenantHome () {
  const {
    session, telemetry, allocation, allocations, periods, period, periodId,
    state, splitRule, nowMs, estimateRate, currentPeriodId, alerts
  } = useApp()

  const tid = session.tenantId
  const tenant = TENANT_BY_ID[tid]
  const colour = participantColor(tid)
  const me = allocation.perTenant[tid]
  const isOpen = periodId === currentPeriodId

  // Previous period, for the comparison the PRD asks for on Home.
  const idx = periods.findIndex((p) => p.id === periodId)
  const prev = idx > 0 ? allocations[periods[idx - 1].id] : null
  const prevMe = prev?.perTenant[tid] ?? null

  const myDevices = devicesFor(tid, state.assignments)
  const live = tenant.isResidual
    ? liveResidualKw(telemetry) + (liveKw(telemetry, myDevices.map((d) => d.id)) ?? 0)
    : liveKw(telemetry, myDevices.map((d) => d.id))
  const powerData = participantPower(telemetry, tid, state.assignments, 48)

  const daily = participantDaily(telemetry, allocation, tid, state.assignments, allocation.splitShares[tid])
  const { elapsed, total } = periodDays(period, nowMs)

  const cost = isOpen ? me.allocatedKwh * estimateRate : me.cost
  const projectedKwh = isOpen ? projectToEnd(me.allocatedKwh, period, nowMs) : null
  const projectedCost = projectedKwh != null ? projectedKwh * estimateRate : null

  const kwhDelta = prevMe && prevMe.allocatedKwh > 0
    ? (me.allocatedKwh - prevMe.allocatedKwh) / prevMe.allocatedKwh
    : null

  const myDeviceIds = new Set(myDevices.map((d) => d.id))
  const myAlerts = alerts.filter((a) => a.deviceId && myDeviceIds.has(a.deviceId))
  const communalAlert = alerts.find((a) => a.kind === 'offline' && !myDeviceIds.has(a.deviceId))
  const topDevices = deviceRowsFor(allocation, tid, state.assignments).slice(0, 5)

  return (
    <div className="grid" style={{ gap: 14 }}>
      {isOpen && (
        <Notice icon="clock">
          <strong>Day {elapsed} of {total}</strong> in {period.label}. Figures update as
          meters report; costs shown for an open period are estimates until the
          retailer bill is entered.
        </Notice>
      )}

      {myAlerts.map((a) => (
        <Notice key={a.id} tone={a.severity === 'critical' ? 'bad' : 'warn'} icon="alert" title={a.title}>
          {a.body}
        </Notice>
      ))}

      {communalAlert && (
        <Notice tone="warn" icon="alert" title="A communal meter is offline">
          {communalAlert.body} Your communal share for this period may be understated
          until it is fixed. The owner has been alerted.
        </Notice>
      )}

      <div className="grid cols-2">
        <Card>
          <div className="stat-label">Your energy this period</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
            <div className="hero-value num" style={{ color: colour }}>{kwh(me.allocatedKwh, 0)}</div>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>kWh</div>
            {kwhDelta != null && <Delta value={kwhDelta} suffix=" vs last period" />}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            {pct(me.sharePct)} of the whole site · {date(period.startMs)} – {date(period.endMs)}
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>What makes it up</div>
            <CompositionBar
              total={me.allocatedKwh}
              segments={[
                { key: 'direct', label: tenant.isResidual ? 'Your direct usage (residual)' : 'Your own meters', value: me.directKwh, color: colour },
                { key: 'communal', label: `Communal share (${pct(me.communalSharePct, 0)})`, value: me.communalShareKwh, color: communalColor() }
              ]}
            />
          </div>
        </Card>

        <Card>
          <div className="stat-label">{isOpen ? 'Estimated cost so far' : 'Your share of the bill'}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
            <div className="hero-value num">{money(cost)}</div>
            {isOpen && <Badge tone="info" icon="info">Estimate</Badge>}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            {isOpen
              ? <>At {money(estimateRate)}/kWh, the rate from the last issued bill.</>
              : <>{pct(me.sharePct)} of {money(allocation.reconciliation.distributable)} distributable.</>}
          </div>

          {projectedCost != null && (
            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 8 }}>
              <div className="stat-label">Projected full period</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <div>
                  <span className="num" style={{ fontSize: 20, fontWeight: 600 }}>{kwh(projectedKwh, 0)}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}> kWh</span>
                </div>
                <div>
                  <span className="num" style={{ fontSize: 20, fontWeight: 600 }}>{money(projectedCost)}</span>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
                Straight-line from your usage over the first {elapsed} days. Weather and
                habits will move it.
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid side">
        <Card title="Your daily usage" subtitle="Direct metered usage and your share of communal, day by day.">
          <StackedArea
            data={daily}
            height={220}
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

        <Card title="Live demand"
          subtitle={live == null ? 'Your meters are not reporting' : `Right now: ${kw(live)} kW`}>
          <PowerLine data={powerData} color={colour} height={150} label="Your demand" />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Last 48 hours. Live watts are for awareness only — bills are always
            calculated from cumulative meter readings.
          </div>
        </Card>
      </div>

      {topDevices.length > 0 && (
        <Card title="Where your energy went" subtitle="Your own meters this period, largest first.">
          <BarList
            items={topDevices.map((r) => ({
              key: r.deviceId,
              label: `${r.areaName} · ${LOAD_TYPES[r.device.loadType].label}`,
              value: r.kwh,
              color: colour
            }))}
          />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
            Communal endpoints are not shown here — see Usage for the shared areas
            and your {pct(me.communalSharePct, 0)} share of them.
          </div>
        </Card>
      )}
    </div>
  )
}
