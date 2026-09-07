import { useApp } from '../../lib/useApp.jsx'
import { TENANT_BY_ID } from '../../data/site.js'
import { kwh, money, pct } from '../../lib/format.js'
import { Card, Notice, Icon } from '../../components/ui/index.jsx'

/**
 * The plain-English explanation the PRD asks for. Every number in it is the
 * tenant's own, pulled live — an explanation with worked figures is checkable;
 * a generic one is not.
 */
export default function TenantHelp () {
  const { session, allocation, period, splitRule, estimateRate, currentPeriodId, periodId } = useApp()
  const tid = session.tenantId
  const tenant = TENANT_BY_ID[tid]
  const me = allocation.perTenant[tid]
  const rec = allocation.reconciliation
  const isOpen = periodId === currentPeriodId
  const distributable = isOpen ? rec.masterKwh * estimateRate : rec.distributable

  return (
    <div className="grid" style={{ gap: 14, maxWidth: 860 }}>
      <Card title="How your bill is worked out">
        <p>
          The property has one electricity account with the retailer. Rather than
          guessing who used what, the site is metered: every power point, light,
          air conditioner and the stove has its own energy meter, and a
          three-phase meter on the main switchboard measures the whole property.
        </p>
        <p>
          Your bill is your measured usage, plus your agreed share of the areas
          everybody uses.
        </p>
      </Card>

      <Card title="The four steps">
        <Step n="1" title="Read the master meter">
          The three-phase meter recorded <Num>{kwh(rec.masterKwh, 1)} kWh</Num> for
          {' '}{period.label}. That is the whole property — nothing is left out.
        </Step>
        <Step n="2" title="Read everyone's own meters">
          {tenant.isResidual
            ? <>Every other participant’s meters are read for exactly the same dates.
                Your usage is what is left over: the master read less everything that
                was measured elsewhere, which came to <Num>{kwh(me.residualKwh, 1)} kWh</Num>.</>
            : <>Your own meters recorded <Num>{kwh(me.directKwh, 1)} kWh</Num> over exactly
                the same dates. Only your endpoints count towards that.</>}
        </Step>
        <Step n="3" title="Share the communal areas">
          The kitchen, bathroom, laundry, computer room, shared air conditioner and
          the stove used <Num>{kwh(allocation.communalKwh, 1)} kWh</Num> between them.
          Under the current agreement — <strong>{splitRule.name}</strong> — your share
          is <Num>{pct(me.communalSharePct, 0)}</Num>, which
          is <Num>{kwh(me.communalShareKwh, 1)} kWh</Num>.
        </Step>
        <Step n="4" title="Turn energy into money">
          Your total is <Num>{kwh(me.directKwh, 1)}</Num> + <Num>{kwh(me.communalShareKwh, 1)}</Num> =
          {' '}<Num>{kwh(me.allocatedKwh, 1)} kWh</Num>, which
          is <Num>{pct(me.sharePct)}</Num> of the property’s
          {' '}<Num>{kwh(rec.masterKwh, 1)} kWh</Num>. That same percentage is applied to the
          shared portion of the retailer bill
          {' '}(<Num>{money(distributable)}</Num>), giving <Num>{money(isOpen ? me.allocatedKwh * estimateRate : me.cost)}</Num>
          {isOpen ? ' — an estimate until the bill arrives.' : '.'}
        </Step>
      </Card>

      <Card title="Questions people actually ask">
        <Faq q="Why is the main tenant’s figure calculated differently?">
          The cool rooms and back-of-house circuits are mixed through the
          switchboard and cannot be separately metered without rewiring. So the
          main tenant is charged the residual — the master meter less every
          endpoint that <em>is</em> measured. It can never double-count a device
          that belongs to someone else: if a meter is assigned to you, that energy
          is subtracted before the residual is worked out.
        </Faq>
        <Faq q="What if a meter stops reporting?">
          The app shows it as offline and estimates how much energy went
          unattributed. If that figure is material, the owner is blocked from
          issuing statements until it is fixed or they record a written reason.
          Missing data is never quietly absorbed into someone’s bill.
        </Faq>
        <Faq q="Why doesn’t the live watts figure match my bill?">
          Live watts are an instantaneous reading, useful for spotting what is
          running right now. Bills are always calculated from the cumulative
          energy counters read at the exact start and end of the period, which is
          the same method the retailer uses.
        </Faq>
        <Faq q="Can anyone else see my usage?">
          No. Tenants see only their own usage plus the communal totals everyone
          shares. The owner sees the whole site, because they have to reconcile it
          against the retailer bill.
        </Faq>
        <Faq q="Can the app switch things off?">
          No. Every meter in this property is read-only from the app. Relay
          control is deliberately not exposed.
        </Faq>
      </Card>

      <Notice icon="scales">
        This is an allocation of a shared retailer bill between the people who
        live and work here — not a separate sale of electricity. If you think a
        meter is assigned to the wrong person, tell the owner: reassignments are
        recorded in an audit trail with the date and who made them.
      </Notice>
    </div>
  )
}

function Step ({ n, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{
        flex: 'none', width: 26, height: 26, borderRadius: '50%',
        background: 'var(--accent-wash)', color: 'var(--accent)',
        display: 'grid', placeItems: 'center', fontWeight: 650, fontSize: 13
      }}>{n}</div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 3 }}>{title}</div>
        <div style={{ color: 'var(--text-secondary)' }}>{children}</div>
      </div>
    </div>
  )
}

function Faq ({ q, children }) {
  return (
    <details style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 550, listStyle: 'none', display: 'flex', gap: 8, alignItems: 'center' }}>
        <Icon name="chevron" size={13} style={{ color: 'var(--text-muted)' }} />
        {q}
      </summary>
      <div style={{ color: 'var(--text-secondary)', paddingTop: 8, paddingLeft: 21 }}>{children}</div>
    </details>
  )
}

function Num ({ children }) {
  return <strong className="num" style={{ color: 'var(--text-primary)' }}>{children}</strong>
}
