import { useState } from 'react'
import { useApp } from '../lib/useApp.jsx'
import { PRICE, isSupporter } from '../lib/access.js'
import { fmtDate } from '../lib/format.js'
import * as store from '../lib/store.js'

function Join () {
  const { teams } = useApp()
  const [f, setF] = useState({ name: '', email: '', teamId: '' })
  const [signin, setSignin] = useState('')
  const [error, setError] = useState(null)
  const run = (fn) => (e) => { e.preventDefault(); try { fn(); setError(null) } catch (err) { setError(err.message) } }
  return (
    <div className='grid g2' style={{ alignItems: 'start' }}>
      <form className='card stack' onSubmit={run(() => store.register(f))}>
        <h2>Join free</h2>
        <p className='small sec'>Register with the team you support. You can read and follow every game, and talk with supporters of every team once you upgrade.</p>
        <label className='field'><span>Name shown on posts</span><input type='text' value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className='field'><span>Email</span><input type='email' value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className='field'><span>Team you support</span>
          <select value={f.teamId} onChange={(e) => setF({ ...f, teamId: e.target.value })}>
            <option value=''>Choose…</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        {error && <div className='error'>{error}</div>}
        <button className='btn primary'>Create free account</button>
      </form>
      <div className='stack'>
        <form className='card stack' onSubmit={run(() => store.signIn(signin))}>
          <h2>Sign in</h2>
          <label className='field'><span>Email</span><input type='email' value={signin} onChange={(e) => setSignin(e.target.value)} /></label>
          <button className='btn'>Sign in</button>
          <p className='small muted'>Demo accounts: aroha@example.com (free), siya@example.com (supporter), desk@example.com (desk/admin). No passwords in this preview.</p>
        </form>
        <Plans />
      </div>
    </div>
  )
}

function Plans () {
  return (
    <div className='card'>
      <h2>Membership</h2>
      <table>
        <thead><tr><th /><th>Free</th><th>Supporter · {PRICE.label}</th></tr></thead>
        <tbody>
          {[
            ['Weekly international results & stats', true, true],
            ['Every key decision + AI verdict', true, true],
            ['Read discussions', true, true],
            ['Post & reply across all teams', false, true],
            ['Vote on decisions', false, true],
            ['Upload your own evidence for AI review', false, true],
            ['Ask the AI follow-up questions', false, true]
          ].map(([l, a, b]) => <tr key={l}><td className='small'>{l}</td><td>{a ? '✓' : '—'}</td><td>{b ? '✓' : '—'}</td></tr>)}
        </tbody>
      </table>
    </div>
  )
}

export default function Account () {
  const { user, team, state, teams } = useApp()
  const [paying, setPaying] = useState(false)
  if (!user) return <><h1>Join RefLens</h1><Join /></>
  const active = isSupporter(user)
  const payments = state.payments.filter((p) => p.userId === user.id)

  const pay = () => {
    setPaying(true)
    // Stand-in for the checkout redirect + webhook. See README “Payments”.
    setTimeout(() => {
      store.recordSubscriptionPayment(user.id, { amount: PRICE.amount, currency: PRICE.currency, reference: `demo-${Date.now()}` })
      setPaying(false)
    }, 600)
  }

  return (
    <>
      <h1>Your account</h1>
      <div className='grid g2' style={{ alignItems: 'start' }}>
        <div className='card stack'>
          <div><strong>{user.name}</strong> <span className='muted'>· {user.email}</span></div>
          <label className='field'><span>Team you support</span>
            <select value={user.teamId} onChange={(e) => store.updateUser(user.id, { teamId: e.target.value })}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <div className='row'>
            {user.role === 'admin' && <span className='chip accent'>Desk</span>}
            {active
              ? <span className='chip good'>Supporter until {fmtDate(user.subscribedUntil)}</span>
              : <span className='chip'>Free member</span>}
            <span className='chip'>{team(user.teamId)?.name}</span>
          </div>
          <div className='row'>
            <button className='btn primary' onClick={pay} disabled={paying}>
              {paying ? 'Processing…' : active ? `Renew for another year · ${PRICE.label}` : `Upgrade · ${PRICE.label}`}
            </button>
            <button className='btn' onClick={() => store.setSessionUserId(null)}>Sign out</button>
          </div>
          <p className='small muted'>Preview checkout — no card is charged. Early renewals add a year to your current expiry.</p>
          {payments.length > 0 && (
            <table><thead><tr><th>Paid</th><th>Amount</th><th>Covers until</th></tr></thead>
              <tbody>{payments.map((p) => <tr key={p.id}><td>{fmtDate(p.at)}</td><td>US${p.amount.toFixed(2)}</td><td>{fmtDate(p.until)}</td></tr>)}</tbody>
            </table>
          )}
        </div>
        <Plans />
      </div>
    </>
  )
}
