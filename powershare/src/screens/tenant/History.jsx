import { useApp } from '../../lib/useApp.jsx'
import { TENANT_BY_ID } from '../../data/site.js'
import { participantColor, communalColor } from '../../lib/palette.js'
import { kwh, money, pct } from '../../lib/format.js'
import { participantDaily } from '../../lib/views.js'
import { Card, Stat, Delta, Notice } from '../../components/ui/index.jsx'
import { GroupedBars, BarList } from '../../components/charts/Bars.jsx'
import { StackedArea } from '../../components/charts/TimeSeries.jsx'

export default function TenantHistory () {
  const { session, periods, allocations, telemetry, state, currentPeriodId, estimateRate } = useApp()

  const tid = session.tenantId
  const tenant = TENANT_BY_ID[tid]
  const colour = participantColor(tid)

  const rows = periods.map((p) => {
    const a = allocations[p.id]
    const x = a.perTenant[tid]
    return {
      period: p,
      alloc: a,
      x,
      open: p.id === currentPeriodId,
      cost: p.id === currentPeriodId ? x.allocatedKwh * estimateRate : x.cost
    }
  })

  const closed = rows.filter((r) => !r.open)
  const avg = closed.length ? closed.reduce((a, r) => a + r.x.allocatedKwh, 0) / closed.length : 0
  const latest = rows.at(-1)
  const vsAvg = avg > 0 ? (latest.x.allocatedKwh - avg) / avg : null

  // Full-history daily series, stitched across every period.
  const allDaily = periods.flatMap((p) =>
    participantDaily(telemetry, allocations[p.id], tid, state.assignments, allocations[p.id].splitShares[tid])
  )

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid cols-3">
        <Card>
          <Stat label="Average per closed period" value={kwh(avg, 0)} unit=" kWh"
            sub={`${closed.length} completed periods`} />
        </Card>
        <Card>
          <Stat label="Current period" value={kwh(latest.x.allocatedKwh, 0)} unit=" kWh"
            delta={vsAvg != null ? <Delta value={vsAvg} suffix=" vs average" /> : null}
            sub={latest.open ? 'still running' : 'complete'} />
        </Card>
        <Card>
          <Stat label="Your typical share" value={pct(
            rows.reduce((a, r) => a + r.x.sharePct, 0) / rows.length
          )} sub="of the whole site" />
        </Card>
      </div>

      <Card title="Period by period"
        subtitle="Direct usage and communal share for every billing period.">
        <GroupedBars
          height={230}
          groups={rows.map((r) => ({
            key: r.period.id,
            label: r.period.label.replace(' 2026', ''),
            subLabel: r.open ? 'in progress' : undefined,
            values: { direct: r.x.directKwh, communal: r.x.communalShareKwh }
          }))}
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
        {latest.open && (
          <div style={{ marginTop: 12 }}>
            <Notice icon="info">
              The final bar covers a period that is still running, so it is not yet
              comparable to the completed periods beside it.
            </Notice>
          </div>
        )}
      </Card>

      <Card title="Daily usage across every period"
        subtitle="The whole record since metering was commissioned in May 2026.">
        <StackedArea
          data={allDaily}
          height={230}
          series={[
            { key: 'direct', label: 'Direct', color: colour },
            { key: 'communal', label: 'Communal share', color: communalColor() }
          ]}
        />
      </Card>

      <Card title="The numbers">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Period</th>
                <th className="n">Direct</th>
                <th className="n">Communal share</th>
                <th className="n">Allocated</th>
                <th className="n">Site total</th>
                <th className="n">Your share</th>
                <th className="n">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.period.id}>
                  <td>{r.period.label}{r.open ? ' (open)' : ''}</td>
                  <td className="n">{kwh(r.x.directKwh, 1)}</td>
                  <td className="n">{kwh(r.x.communalShareKwh, 1)}</td>
                  <td className="n">{kwh(r.x.allocatedKwh, 1)}</td>
                  <td className="n">{kwh(r.alloc.reconciliation.masterKwh, 0)}</td>
                  <td className="n">{pct(r.x.sharePct)}</td>
                  <td className="n">{money(r.cost)}{r.open ? '*' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
          * estimated — the open period has no retailer bill yet.
        </div>
      </Card>
    </div>
  )
}
