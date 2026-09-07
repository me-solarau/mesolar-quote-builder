import { useState } from 'react'

import { useApp } from '../../lib/useApp.jsx'
import { TENANTS, SITE, DEVICES } from '../../data/site.js'
import { participantColor } from '../../lib/palette.js'
import { pct } from '../../lib/format.js'
import { splitShares } from '../../lib/allocation.js'
import { Card, Field, Notice, Badge, Icon, Modal } from '../../components/ui/index.jsx'

export default function OwnerSettings () {
  const { state, splitRule, session, store, allocation, site } = useApp()
  const [editing, setEditing] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card title="Communal split rule"
        subtitle="How the shared areas are divided. Changing this recalculates every open period; issued statements keep the rule they were issued under.">
        <div style={{ display: 'grid', gap: 10 }}>
          {state.splitRules.map((r) => {
            const active = r.id === splitRule.id
            const shares = splitShares(r, TENANTS.map((t) => t.id))
            return (
              <div key={r.id} style={{
                border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
                background: active ? 'var(--accent-wash)' : 'var(--surface-1)',
                borderRadius: 'var(--radius)', padding: 14
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <strong>{r.name}</strong>
                  {active && <Badge tone="info" icon="check">Active</Badge>}
                  <div style={{ flex: 1 }} />
                  {r.mode !== 'equal' && (
                    <button className="btn sm" onClick={() => setEditing(r)}>Edit weights</button>
                  )}
                  {!active && (
                    <button className="btn sm primary"
                      onClick={() => store.setActiveSplitRule(r.id, session.role)}>Make active</button>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 12.5 }}>
                  {TENANTS.map((t) => (
                    <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span className="legend-swatch" style={{ background: participantColor(t.id) }} />
                      {t.shortName}
                      <strong className="num">{pct(shares[t.id], 0)}</strong>
                    </span>
                  ))}
                </div>
                {r.note && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{r.note}</div>}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 14 }}>
          <Notice icon="scales">
            The split is a tenancy agreement, not a technical setting. Whatever is
            chosen here appears on every tenant’s statement and in their Help
            screen, so all four participants see the same rule.
          </Notice>
        </div>
      </Card>

      <div className="grid cols-2">
        <Card title="Site" subtitle="Physical configuration this build is modelled on.">
          <table className="data">
            <tbody>
              <tr><td>Property</td><td className="n">{SITE.name}</td></tr>
              <tr><td>Location</td><td className="n">{SITE.suburb}</td></tr>
              <tr><td>Supply</td><td className="n">{SITE.supply}</td></tr>
              <tr><td>Time zone</td><td className="n">{SITE.timezone}</td></tr>
              <tr><td>Cost participants</td><td className="n">{TENANTS.length}</td></tr>
              <tr><td>Meters</td><td className="n">{DEVICES.length}</td></tr>
            </tbody>
          </table>
        </Card>

        <Card title="Reconciliation thresholds"
          subtitle="The guard rails that decide when the app refuses to issue a statement.">
          <table className="data">
            <tbody>
              <tr>
                <td>Residual expected range
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Warns if the main tenant’s residual falls outside this band
                  </div>
                </td>
                <td className="n">{pct(site.residualExpectedMin, 0)} – {pct(site.residualExpectedMax, 0)}</td>
              </tr>
              <tr>
                <td>Unattributed-energy threshold
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Blocks statement issue above this share of the master read
                  </div>
                </td>
                <td className="n">{pct(site.integrityThreshold, 1)}</td>
              </tr>
              <tr>
                <td>Current period</td>
                <td className="n">
                  {pct(allocation.reconciliation.atRiskPct, 2)} unattributed
                  {allocation.reconciliation.integrityBlocked
                    ? <span style={{ marginLeft: 8 }}><Badge tone="bad" icon="alert">Blocking</Badge></span>
                    : <span style={{ marginLeft: 8 }}><Badge tone="good" icon="check">OK</Badge></span>}
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            The PRD’s success measure is monthly reconciliation within 1–2% of the
            master meter, so the block sits at {pct(site.integrityThreshold, 1)}.
          </div>
        </Card>
      </div>

      <Card title="Demo data"
        subtitle="Bills, assignments, split rules, statements, overrides and the audit trail are stored in this browser.">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn danger" onClick={() => setConfirmReset(true)}>
            <Icon name="history" size={14} /> Reset to seeded state
          </button>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            Meter telemetry is generated deterministically and is not affected.
          </span>
        </div>
      </Card>

      {editing && (
        <WeightsModal rule={editing} onClose={() => setEditing(null)}
          onSave={(next) => { store.saveSplitRule(next, session.role); setEditing(null) }} />
      )}

      {confirmReset && (
        <Modal title="Reset demo data" onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="btn danger" onClick={() => { store.resetDemoData(); setConfirmReset(false) }}>
                Reset everything
              </button>
            </>
          }>
          <Notice tone="warn" icon="alert">
            This discards every bill you entered, every reassignment, every issued
            statement and the whole audit trail, and restores the seeded data.
          </Notice>
        </Modal>
      )}
    </div>
  )
}

function WeightsModal ({ rule, onClose, onSave }) {
  const [weights, setWeights] = useState(() => ({ ...rule.weights }))
  const total = TENANTS.reduce((a, t) => a + (Number(weights[t.id]) || 0), 0)
  const shares = splitShares({ mode: 'weighted', weights }, TENANTS.map((t) => t.id))

  return (
    <Modal title={`Edit “${rule.name}”`} onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={total <= 0}
            onClick={() => onSave({ ...rule, weights })}>Save weights</button>
        </>
      }>
      <div style={{ display: 'grid', gap: 12 }}>
        {TENANTS.map((t) => (
          <Field key={t.id} label={t.name}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="number" min="0" value={weights[t.id] ?? 0}
                onChange={(e) => setWeights((w) => ({ ...w, [t.id]: Number(e.target.value) }))}
                style={{ width: 100 }} />
              <span className="num" style={{ color: 'var(--text-secondary)', minWidth: 56 }}>
                = {pct(shares[t.id], 1)}
              </span>
              <div style={{ flex: 1, height: 8, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${shares[t.id] * 100}%`, background: participantColor(t.id) }} />
              </div>
            </div>
          </Field>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <Notice icon="info">
          Weights are relative — they do not have to add to 100. The current total
          is {total}, so each weight is divided by {total} to get the share above.
        </Notice>
      </div>
    </Modal>
  )
}
