import { useApp } from '../../lib/useApp.jsx'
import { TENANT_BY_ID } from '../../data/site.js'
import { participantColor } from '../../lib/palette.js'
import { kwh, money, pct, date } from '../../lib/format.js'
import { periodDays, projectToEnd } from '../../lib/views.js'
import { buildSnapshot } from '../../lib/statement.js'
import { Card, Stat, Notice, Badge, Empty } from '../../components/ui/index.jsx'
import Statement, { PrintButton } from '../../components/Statement.jsx'
import { GroupedBars } from '../../components/charts/Bars.jsx'

export default function TenantCosts () {
  const {
    session, periods, allocations, period, periodId, currentPeriodId,
    estimateRate, state, splitRule, nowMs
  } = useApp()

  const tid = session.tenantId
  const colour = participantColor(tid)
  const isOpen = periodId === currentPeriodId
  const allocation = allocations[periodId]
  const me = allocation.perTenant[tid]

  const statement = state.statements.find((s) => s.periodId === periodId) ?? null
  const bill = state.bills.find((b) => b.periodId === periodId) ?? null
  const override = state.overrides.find((o) => o.periodId === periodId) ?? null

  // Statements issued before this build have no stored snapshot; recompute so
  // the tenant still sees the document. A real deployment always has one.
  const snapshot = statement?.snapshot ??
    (bill ? buildSnapshot({ period, allocation, splitRule, bill, override }) : null)

  const { elapsed, total } = periodDays(period, nowMs)
  const estCost = me.allocatedKwh * estimateRate
  const projected = projectToEnd(me.allocatedKwh, period, nowMs)

  const issuedPeriods = periods.filter((p) => state.statements.some((s) => s.periodId === p.id))
  const history = issuedPeriods.map((p) => ({
    key: p.id,
    label: p.label.replace(' 2026', ''),
    values: { cost: allocations[p.id].perTenant[tid].cost }
  }))

  return (
    <div className="grid" style={{ gap: 14 }}>
      {isOpen
        ? (
          <Card title="This period so far" subtitle={`Day ${elapsed} of ${total}. No retailer bill has been entered yet.`}>
            <div className="grid cols-3">
              <Stat label="Allocated energy" value={kwh(me.allocatedKwh, 0)} unit=" kWh"
                sub={`${pct(me.sharePct)} of the site`} />
              <Stat label="Estimated cost so far" value={money(estCost)}
                sub={`at ${money(estimateRate)}/kWh`} />
              <Stat label="Projected full period"
                value={projected != null ? money(projected * estimateRate) : '—'}
                sub={projected != null ? `${kwh(projected, 0)} kWh at this run rate` : 'not enough data yet'} />
            </div>
            <div style={{ marginTop: 14 }}>
              <Notice icon="info">
                Estimates use the rate from the last issued bill
                ({money(estimateRate)}/kWh). Your final share is calculated from the
                actual retailer invoice when the owner enters it, using the same
                formula shown on every statement.
              </Notice>
            </div>
          </Card>
          )
        : snapshot
          ? (
            <>
              <Card title="Your statement" subtitle={period.label}
                action={<PrintButton />}>
                <Statement snapshot={snapshot} issuedAtMs={statement?.issuedAtMs}
                  focusTenantId={tid} draft={!statement} />
              </Card>
            </>
            )
          : (
            <Card>
              <Empty icon="billing" title="No statement for this period">
                The owner has not entered a retailer bill for {period.label} yet.
              </Empty>
            </Card>
            )}

      {history.length > 1 && (
        <Card title="Your cost history" subtitle="Issued statements only.">
          <GroupedBars
            groups={history}
            series={[{ key: 'cost', label: 'Your share', color: colour }]}
            valueFormat={(v) => money(v)}
            unit=""
            height={200}
          />
        </Card>
      )}

      <Card title="Every period" subtitle="What you were allocated, and what it cost.">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Period</th>
                <th className="n">Direct kWh</th>
                <th className="n">Communal share</th>
                <th className="n">Allocated kWh</th>
                <th className="n">Share of site</th>
                <th className="n">Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                const a = allocations[p.id]
                const x = a.perTenant[tid]
                const st = state.statements.find((s) => s.periodId === p.id)
                const open = p.id === currentPeriodId
                return (
                  <tr key={p.id}>
                    <td>{p.label}</td>
                    <td className="n">{kwh(x.directKwh, 1)}</td>
                    <td className="n">{kwh(x.communalShareKwh, 1)}</td>
                    <td className="n">{kwh(x.allocatedKwh, 1)}</td>
                    <td className="n">{pct(x.sharePct)}</td>
                    <td className="n">
                      {st ? money(x.cost) : open ? `${money(x.allocatedKwh * estimateRate)}*` : '—'}
                    </td>
                    <td>
                      {st
                        ? <Badge tone="good" icon="check">Issued</Badge>
                        : open
                          ? <Badge tone="info" icon="clock">In progress</Badge>
                          : <Badge tone="warn">Awaiting bill</Badge>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
          * estimated at {money(estimateRate)}/kWh — the open period has no retailer bill yet.
        </div>
      </Card>
    </div>
  )
}
