import { useState } from 'react'

import { useApp } from '../../lib/useApp.jsx'
import { TENANTS } from '../../data/site.js'
import { participantColor } from '../../lib/palette.js'
import { kwh, money, pct, signedPct, date, fullDateTime } from '../../lib/format.js'
import { buildSnapshot } from '../../lib/statement.js'
import {
  Card, Stat, Badge, Notice, Modal, Field, Icon, Empty
} from '../../components/ui/index.jsx'
import Statement, { PrintButton } from '../../components/Statement.jsx'
import { BarList } from '../../components/charts/Bars.jsx'

const AEST = 10 * 3600_000
const toDateInput = (ms) => new Date(ms + AEST).toISOString().slice(0, 10)
const fromDateInput = (v) => Date.parse(`${v}T00:00:00Z`) - AEST

export default function OwnerBilling () {
  const {
    allocation, allocations, period, periodId, periods, currentPeriodId, state,
    splitRule, site, session, store
  } = useApp()

  const [editingBill, setEditingBill] = useState(false)
  const [overriding, setOverriding] = useState(false)
  const [issuing, setIssuing] = useState(false)

  const bill = state.bills.find((b) => b.periodId === periodId) ?? null
  const statement = state.statements.find((s) => s.periodId === periodId) ?? null
  const override = state.overrides.find((o) => o.periodId === periodId) ?? null
  const rec = allocation.reconciliation
  const isOpen = periodId === currentPeriodId

  const blocked = rec.integrityBlocked && !override
  const canIssue = !!bill && !blocked

  const snapshot = statement?.snapshot ??
    (bill ? buildSnapshot({ period, allocation, splitRule, bill, override }) : null)

  return (
    <div className="grid" style={{ gap: 14 }}>
      {blocked && (
        <Notice tone="bad" icon="alert" title="Statement generation is blocked"
          action={<button className="btn sm" onClick={() => setOverriding(true)}>Override…</button>}>
          {kwh(rec.atRiskKwh, 1)} kWh ({pct(rec.atRiskPct, 2)} of the master read) passed
          through the site while a meter was not reporting. That is above the
          {' '}{pct(site.integrityThreshold, 1)} threshold, so the allocation would
          silently overcharge the main tenant. Restore the meter, or record a
          reason to proceed anyway.
        </Notice>
      )}

      {override && (
        <Notice tone="warn" icon="alert" title="Data-integrity override in force"
          action={<button className="btn sm" onClick={() => store.clearOverride(periodId, session.role, period.label)}>Withdraw</button>}>
          Recorded by {override.by} on {fullDateTime(override.byMs)}: “{override.reason}”
          {' '}This is printed on every statement issued for this period.
        </Notice>
      )}

      <div className="grid side">
        <Card title="Retailer bill" subtitle={period.label}
          action={<button className="btn" onClick={() => setEditingBill(true)}>
            <Icon name={bill ? 'settings' : 'plus'} size={14} /> {bill ? 'Edit' : 'Enter bill'}
          </button>}>
          {bill
            ? (
              <>
                <div className="grid cols-3">
                  <Stat label="Billed energy" value={kwh(bill.totalKwh, 0)} unit=" kWh"
                    sub={`master read ${kwh(rec.masterKwh, 0)} · ${signedPct(rec.billKwhVariance, 2)}`} />
                  <Stat label="Invoice total" value={money(bill.retailerTotal)}
                    sub={`${bill.retailer} · ${bill.invoiceNo}`} />
                  <Stat label="Distributable" value={money(bill.distributableAmount)}
                    sub={bill.supplyCharge ? `${money(bill.supplyCharge)} supply charge retained` : 'whole invoice shared'} />
                </div>
                {bill.note && (
                  <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    <Icon name="info" size={13} /> {bill.note}
                  </div>
                )}
                {Math.abs(rec.billKwhVariance ?? 0) > 0.02 && (
                  <div style={{ marginTop: 12 }}>
                    <Notice tone="warn" icon="alert">
                      The master meter and the retailer disagree by
                      {' '}{signedPct(rec.billKwhVariance, 2)}. Check that the bill dates
                      match the metering period exactly before issuing.
                    </Notice>
                  </div>
                )}
              </>
              )
            : (
              <Empty icon="billing" title="No bill entered for this period">
                {isOpen
                  ? 'This period is still running. Enter the retailer bill once it arrives.'
                  : 'Enter the retailer bill to allocate costs and issue statements.'}
              </Empty>
              )}
        </Card>

        <Card title="Communal split" subtitle={`${kwh(allocation.communalKwh, 1)} kWh to divide`}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>{splitRule.name}</div>
          <BarList
            unit="kWh"
            height={20}
            items={TENANTS.map((t) => ({
              key: t.id,
              label: `${t.shortName} — ${pct(allocation.splitShares[t.id], 0)}`,
              value: allocation.perTenant[t.id].communalShareKwh,
              color: participantColor(t.id)
            }))}
          />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
            Change the rule in Settings. Issued statements keep the split they were
            issued under.
          </div>
        </Card>
      </div>

      <Card
        title="Statements"
        subtitle={statement
          ? `Issued ${fullDateTime(statement.issuedAtMs)} by ${statement.issuedBy}`
          : 'Not yet issued for this period.'}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            {snapshot && <PrintButton />}
            <button className="btn primary" disabled={!canIssue} onClick={() => setIssuing(true)}>
              <Icon name="check" size={14} /> {statement ? 'Re-issue' : 'Issue statements'}
            </button>
          </div>
        }
      >
        {!bill
          ? <Empty icon="billing" title="Enter the retailer bill first">
              Statements allocate an actual invoice — there is nothing to allocate yet.
            </Empty>
          : (
            <>
              {!statement && (
                <div style={{ marginBottom: 14 }}>
                  <Notice icon="info">
                    This is a draft. Nothing is sent to tenants until you issue it,
                    and issuing freezes these figures against later rule changes.
                  </Notice>
                </div>
              )}
              <Statement snapshot={snapshot} issuedAtMs={statement?.issuedAtMs} draft={!statement} />
            </>
            )}
      </Card>

      <Card title="All periods">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Period</th>
                <th className="n">Master kWh</th>
                <th className="n">Billed kWh</th>
                <th className="n">Variance</th>
                <th className="n">Distributable</th>
                <th className="n">Unattributed</th>
                <th>Statement</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                const a = allocations[p.id]
                const b = state.bills.find((x) => x.periodId === p.id)
                const st = state.statements.find((x) => x.periodId === p.id)
                return (
                  <tr key={p.id}>
                    <td>{p.label}{p.id === currentPeriodId ? ' (open)' : ''}</td>
                    <td className="n">{kwh(a.reconciliation.masterKwh, 0)}</td>
                    <td className="n">{b ? kwh(b.totalKwh, 0) : '—'}</td>
                    <td className="n">{a.reconciliation.billKwhVariance != null ? signedPct(a.reconciliation.billKwhVariance, 2) : '—'}</td>
                    <td className="n">{b ? money(b.distributableAmount) : '—'}</td>
                    <td className="n">
                      {a.reconciliation.atRiskKwh > 0.05 ? `${kwh(a.reconciliation.atRiskKwh, 1)} kWh` : '—'}
                    </td>
                    <td>
                      {st
                        ? <Badge tone="good" icon="check">Issued</Badge>
                        : a.reconciliation.integrityBlocked && !state.overrides.some((o) => o.periodId === p.id)
                          ? <Badge tone="bad" icon="alert">Blocked</Badge>
                          : b
                            ? <Badge tone="warn">Ready</Badge>
                            : <Badge>Awaiting bill</Badge>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {editingBill && (
        <BillModal period={period} bill={bill} masterKwh={rec.masterKwh}
          onClose={() => setEditingBill(false)}
          onSave={(next) => { store.saveBill(next, session.role); setEditingBill(false) }} />
      )}

      {overriding && (
        <OverrideModal atRiskKwh={rec.atRiskKwh} atRiskPct={rec.atRiskPct}
          onClose={() => setOverriding(false)}
          onSave={(reason) => {
            store.recordOverride(periodId, reason, session.role, rec.atRiskKwh, period.label)
            setOverriding(false)
          }} />
      )}

      {issuing && (
        <IssueModal
          snapshot={buildSnapshot({ period, allocation, splitRule, bill, override })}
          reissue={!!statement}
          onClose={() => setIssuing(false)}
          onConfirm={(note) => {
            store.issueStatement(
              periodId,
              buildSnapshot({ period, allocation, splitRule, bill, override }),
              session.role,
              note
            )
            setIssuing(false)
          }} />
      )}
    </div>
  )
}

function BillModal ({ period, bill, masterKwh, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    id: bill?.id ?? `rb-${period.id}`,
    periodId: period.id,
    retailer: bill?.retailer ?? 'Origin Energy',
    invoiceNo: bill?.invoiceNo ?? '',
    startMs: bill?.startMs ?? period.startMs,
    endMs: bill?.endMs ?? period.endMs,
    totalKwh: bill?.totalKwh ?? Math.round(masterKwh),
    retailerTotal: bill?.retailerTotal ?? 0,
    supplyCharge: bill?.supplyCharge ?? 0,
    distributableAmount: bill?.distributableAmount ?? 0,
    note: bill?.note ?? ''
  }))

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const variance = form.totalKwh > 0 ? (masterKwh - form.totalKwh) / form.totalKwh : 0
  const valid = form.totalKwh > 0 && form.distributableAmount > 0 && form.endMs > form.startMs

  return (
    <Modal wide title={bill ? 'Edit retailer bill' : 'Enter retailer bill'} onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid} onClick={() => onSave(form)}>Save bill</button>
        </>
      }>
      <div className="grid cols-2" style={{ gap: 12 }}>
        <Field label="Retailer">
          <input type="text" value={form.retailer} onChange={(e) => set('retailer', e.target.value)} />
        </Field>
        <Field label="Invoice number">
          <input type="text" value={form.invoiceNo} onChange={(e) => set('invoiceNo', e.target.value)} />
        </Field>
        <Field label="Bill period start"
          hint="Recorded on the statement. Meter reads are always taken at the billing-period boundaries above, so a mismatch here means the invoice covers different dates than the energy it is being spread over.">
          <input type="date" value={toDateInput(form.startMs)}
            onChange={(e) => set('startMs', fromDateInput(e.target.value))} />
        </Field>
        <Field label="Bill period end">
          <input type="date" value={toDateInput(form.endMs)}
            onChange={(e) => set('endMs', fromDateInput(e.target.value))} />
        </Field>
        <Field label="Total billed energy (kWh)"
          hint={`Master meter recorded ${kwh(masterKwh, 1)} kWh for this period.`}>
          <input type="number" value={form.totalKwh}
            onChange={(e) => set('totalKwh', Number(e.target.value))} />
        </Field>
        <Field label="Invoice total (incl. GST)">
          <input type="number" step="0.01" value={form.retailerTotal}
            onChange={(e) => set('retailerTotal', Number(e.target.value))} />
        </Field>
        <Field label="Supply charge retained by owner"
          hint="Optional. Anything the owner absorbs rather than sharing.">
          <input type="number" step="0.01" value={form.supplyCharge}
            onChange={(e) => {
              const sc = Number(e.target.value)
              setForm((f) => ({ ...f, supplyCharge: sc, distributableAmount: Math.max(0, Number((f.retailerTotal - sc).toFixed(2))) }))
            }} />
        </Field>
        <Field label="Distributable amount"
          hint="The portion actually shared between participants.">
          <input type="number" step="0.01" value={form.distributableAmount}
            onChange={(e) => set('distributableAmount', Number(e.target.value))} />
        </Field>
      </div>

      <div style={{ marginTop: 12 }}>
        <Field label="Note (appears on statements)">
          <textarea value={form.note} onChange={(e) => set('note', e.target.value)} />
        </Field>
      </div>

      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        {(form.startMs !== period.startMs || form.endMs !== period.endMs) && (
          <Notice tone="warn" icon="alert" title="Bill dates do not match the metering period">
            This invoice is dated {date(form.startMs)} – {date(form.endMs)}, but the
            allocation reads the meters at {date(period.startMs)} – {date(period.endMs)}.
            The energy split will not correspond to the invoice. Either correct the
            dates, or ask the retailer for a bill aligned to the metering period.
          </Notice>
        )}
        {form.totalKwh > 0 && (
          <Notice tone={Math.abs(variance) > 0.02 ? 'warn' : 'good'}
            icon={Math.abs(variance) > 0.02 ? 'alert' : 'check'}>
            Master read {kwh(masterKwh, 1)} kWh vs {kwh(form.totalKwh, 0)} kWh billed —
            a variance of {signedPct(variance, 2)}.
            {Math.abs(variance) > 0.02
              ? ' Check the dates: anything beyond ±2% usually means the bill period and the metering period do not line up.'
              : ' Within the expected tolerance.'}
          </Notice>
        )}
      </div>
    </Modal>
  )
}

function OverrideModal ({ atRiskKwh, atRiskPct, onClose, onSave }) {
  const [reason, setReason] = useState('')
  return (
    <Modal title="Override the data-integrity block" onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn danger" disabled={reason.trim().length < 12}
            onClick={() => onSave(reason.trim())}>Record override</button>
        </>
      }>
      <Notice tone="bad" icon="alert" title={`${kwh(atRiskKwh, 1)} kWh is unattributed`}>
        That is {pct(atRiskPct, 2)} of the master read. Whatever it was, the residual
        calculation will charge it to the main tenant.
      </Notice>
      <div style={{ marginTop: 14 }}>
        <Field label="Reason for proceeding"
          hint="Recorded in the audit trail, shown to the owner, and printed on every statement issued for this period. At least 12 characters.">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Shared AC meter offline 2–7 Sep; main tenant has agreed to absorb the shortfall this period while the access point is replaced." />
        </Field>
      </div>
    </Modal>
  )
}

function IssueModal ({ snapshot, reissue, onClose, onConfirm }) {
  const [note, setNote] = useState('')
  return (
    <Modal wide title={reissue ? 'Re-issue statements' : 'Issue statements'} onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => onConfirm(note.trim())}>
            {reissue ? 'Re-issue' : 'Issue'} to {snapshot.rows.length} participants
          </button>
        </>
      }>
      {reissue && (
        <div style={{ marginBottom: 12 }}>
          <Notice tone="warn" icon="alert">
            This replaces the statement already issued for {snapshot.periodLabel}.
            Both the old and new figures stay in the audit trail.
          </Notice>
        </div>
      )}
      <div className="table-wrap" style={{ margin: 0 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Participant</th>
              <th className="n">Allocated kWh</th>
              <th className="n">Share</th>
              <th className="n">Cost</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.rows.map((r) => (
              <tr key={r.tenantId}>
                <td><span className="swatch" style={{ background: participantColor(r.tenantId) }} />{r.name}</td>
                <td className="n">{kwh(r.allocatedKwh, 1)}</td>
                <td className="n">{pct(r.sharePct)}</td>
                <td className="n">{money(r.cost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="n">{kwh(snapshot.masterKwh, 1)}</td>
              <td className="n">100.0%</td>
              <td className="n">{money(snapshot.distributable)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{ marginTop: 14 }}>
        <Field label="Note to participants (optional)">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
