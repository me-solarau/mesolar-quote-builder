import { participantColor } from '../lib/palette.js'
import { kwh, money, pct, date, fullDateTime } from '../lib/format.js'
import { Badge, Notice, Icon } from './ui/index.jsx'

/**
 * A tenant statement. Rendered identically for the owner (all participants) and
 * for a tenant (their own row only), because a statement nobody can check is
 * not transparent.
 */
export default function Statement ({ snapshot, issuedAtMs, focusTenantId = null, draft = false }) {
  if (!snapshot) return null
  const rows = focusTenantId
    ? snapshot.rows.filter((r) => r.tenantId === focusTenantId)
    : snapshot.rows

  return (
    <article className="statement">
      <header className="statement-head">
        <div>
          <h2>{focusTenantId ? 'Electricity statement' : 'Allocation statement'}</h2>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
            {snapshot.siteName} · {snapshot.siteSuburb}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {date(snapshot.startMs)} – {date(snapshot.endMs)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {draft
            ? <Badge tone="warn" icon="info">Draft — not issued</Badge>
            : <Badge tone="good" icon="check">Issued {issuedAtMs ? fullDateTime(issuedAtMs) : ''}</Badge>}
          {snapshot.bill && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              {snapshot.bill.retailer} · {snapshot.bill.invoiceNo}
            </div>
          )}
        </div>
      </header>

      {rows.map((r) => (
        <section key={r.tenantId} style={{ marginBottom: rows.length > 1 ? 30 : 0 }}>
          {rows.length > 1 && (
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: participantColor(r.tenantId) }} />
              {r.name}
            </h3>
          )}
          <table className="lines">
            <tbody>
              <tr>
                <td>
                  {r.isResidual ? 'Direct usage (residual — master less all measured endpoints)' : 'Your directly metered usage'}
                </td>
                <td className="n">{kwh(r.directKwh, 1)} kWh</td>
              </tr>
              {r.isResidual && r.privateMeteredKwh > 0 && (
                <tr>
                  <td style={{ paddingLeft: 18, color: 'var(--text-muted)' }}>
                    of which individually metered
                  </td>
                  <td className="n" style={{ color: 'var(--text-muted)' }}>{kwh(r.privateMeteredKwh, 1)} kWh</td>
                </tr>
              )}
              <tr>
                <td>
                  Communal usage {kwh(snapshot.communalKwh, 1)} kWh × your share {pct(r.communalSharePct, 0)}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{snapshot.splitRuleName}</div>
                </td>
                <td className="n">{kwh(r.communalShareKwh, 1)} kWh</td>
              </tr>
              <tr>
                <td><strong>Allocated energy</strong></td>
                <td className="n"><strong>{kwh(r.allocatedKwh, 1)} kWh</strong></td>
              </tr>
              <tr>
                <td>
                  Share of the site total
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {kwh(r.allocatedKwh, 1)} ÷ {kwh(snapshot.masterKwh, 1)} kWh master read
                  </div>
                </td>
                <td className="n">{pct(r.sharePct)}</td>
              </tr>
              <tr>
                <td>
                  Distributable bill amount
                  {snapshot.bill?.supplyCharge != null && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Invoice {money(snapshot.bill.retailerTotal)} less {money(snapshot.bill.supplyCharge)} supply charge retained by the owner
                    </div>
                  )}
                </td>
                <td className="n">{money(snapshot.distributable)}</td>
              </tr>
              <tr className="total">
                <td>Your share of the bill</td>
                <td className="n">{money(r.cost)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}

      {rows.length > 1 && (
        <table className="lines" style={{ marginTop: 6 }}>
          <tbody>
            <tr className="total">
              <td>All participants</td>
              <td className="n">
                {kwh(rows.reduce((a, r) => a + r.allocatedKwh, 0), 1)} kWh · {money(rows.reduce((a, r) => a + r.cost, 0))}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {(snapshot.integrity.override || snapshot.corrections.length > 0 || snapshot.integrity.atRiskKwh > 0.5) && (
        <div style={{ marginTop: 20, display: 'grid', gap: 10 }}>
          {snapshot.integrity.override && (
            <Notice tone="warn" icon="alert" title="Issued with a data-integrity override">
              {kwh(snapshot.integrity.atRiskKwh, 1)} kWh
              ({pct(snapshot.integrity.atRiskPct, 2)} of the master read) could not be
              attributed to a meter. Reason recorded by {snapshot.integrity.override.by}:
              “{snapshot.integrity.override.reason}”
            </Notice>
          )}
          {!snapshot.integrity.override && snapshot.integrity.atRiskKwh > 0.5 && (
            <Notice icon="info">
              {kwh(snapshot.integrity.atRiskKwh, 1)} kWh ({pct(snapshot.integrity.atRiskPct, 2)})
              was unattributed during short meter outages this period. Below the
              threshold that blocks issue, but recorded here for completeness.
            </Notice>
          )}
          {snapshot.corrections.map((c) => (
            <Notice key={c.deviceId} icon="info" title={`Meter correction — ${c.name}`}>
              The cumulative counter reset during this period, so the raw
              end-minus-start delta ({kwh(c.rawKwh, 1)} kWh) was unusable. The billed
              figure of {kwh(c.billedKwh, 1)} kWh was rebuilt by summing only the
              forward movements of the counter.
            </Notice>
          ))}
        </div>
      )}

      <p className="fine">
        Energy figures are cumulative meter readings taken at the exact period
        boundaries. Allocated cost = allocated kWh ÷ master kWh × distributable
        amount. This statement is an allocation of a shared retailer bill, not a
        separate sale of electricity.
        {snapshot.integrity.billKwhVariance != null && (
          <> Master read varies from the retailer’s billed energy by {pct(Math.abs(snapshot.integrity.billKwhVariance), 2)}.</>
        )}
      </p>
    </article>
  )
}

export function PrintButton () {
  return (
    <button className="btn no-print" onClick={() => window.print()}>
      <Icon name="print" size={15} /> Print / save as PDF
    </button>
  )
}
