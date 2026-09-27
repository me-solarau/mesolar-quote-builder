import { useApp, href } from '../lib/useApp.jsx'
import { Kpi, Meter, TeamTag, VerdictChip, lawLabel } from '../components/ui.jsx'
import { officialScorecard } from '../lib/stats.js'
import { pct } from '../lib/format.js'

const Disclaimer = () => (
  <p className='small muted'>
    Scores are unofficial and reflect RefLens reviews of logged key decisions against the available footage. Marginal
    calls count half; inconclusive footage is excluded. They are not World Rugby assessments.
  </p>
)

export function Officials () {
  const { officials, decisions, matches } = useApp()
  const cards = officials.map((o) => ({ o, c: officialScorecard(o.id, decisions, matches) }))
    .sort((a, b) => (b.c.accuracy ?? -1) - (a.c.accuracy ?? -1))
  const section = (role, title) => (
    <div className='card'>
      <h2>{title}</h2>
      <div className='table-wrap'>
        <table>
          <thead><tr><th>Official</th><th className='n'>Games</th><th className='n'>Reviewed</th><th className='n'>Contradicted</th><th style={{ width: '28%' }}>Evidence-supported</th><th className='n'>Fans agree</th></tr></thead>
          <tbody>
            {cards.filter(({ o }) => o.role === role).map(({ o, c }) => (
              <tr key={o.id}>
                <td><a href={href('official', o.id)}>{o.name}</a> <span className='muted small'>({o.union.toUpperCase()})</span></td>
                <td className='n'>{c.matches}</td><td className='n'>{c.reviewed}</td><td className='n'>{c.incorrect}</td>
                <td><div className='row' style={{ flexWrap: 'nowrap' }}><span className='num' style={{ width: 44 }}>{pct(c.accuracy)}</span><div style={{ flex: 1 }}><Meter value={c.accuracy} /></div></div></td>
                <td className='n'>{pct(c.communityAgreement)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
  return (
    <>
      <h1>Referees & TMOs</h1>
      <Disclaimer />
      {section('referee', 'Referees')}
      {section('tmo', 'Television match officials')}
    </>
  )
}

export function Official ({ id }) {
  const { official, decisions, matches } = useApp()
  const o = official(id)
  if (!o) return <p>Official not found. <a href={href('officials')}>All officials</a></p>
  const c = officialScorecard(id, decisions, matches)
  const mine = decisions.filter((d) => d.officialId === id)
  return (
    <>
      <div className='row' style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>{o.name}</h1>
        <span className='chip'>{o.role === 'tmo' ? 'TMO' : 'Referee'}</span>
        <span className='chip'>Union: {o.union.toUpperCase()}</span>
      </div>
      <Disclaimer />
      <div className='card grid g4'>
        <Kpi value={pct(c.accuracy)} label='Evidence-supported' />
        <Kpi value={c.reviewed} label='Decisions reviewed' />
        <Kpi value={c.incorrect} label='Contradicted by evidence' />
        <Kpi value={pct(c.communityAgreement)} label='Supporters agree' />
      </div>
      <div className='card'>
        <h2>By law area</h2>
        <table>
          <thead><tr><th>Law area</th><th className='n'>Supported</th><th className='n'>Marginal</th><th className='n'>Contradicted</th><th className='n'>Inconclusive</th></tr></thead>
          <tbody>
            {Object.entries(c.byLaw).map(([law, v]) => (
              <tr key={law}><td>{lawLabel(law)}</td><td className='n'>{v.correct}</td><td className='n'>{v.marginal}</td><td className='n'>{v.incorrect}</td><td className='n'>{v.inconclusive}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className='card'>
        <h2>Decisions</h2>
        {mine.map((d) => {
          const m = matches.find((x) => x.id === d.matchId)
          return (
            <div key={d.id} className='decision'>
              <div className='minute'>{d.minute}′</div>
              <div>
                <div className='row'><a href={href('match', m.id)}><strong>{d.call}</strong></a><VerdictChip review={d.review} /></div>
                <div className='small muted row'><TeamTag id={m.home} short /> v <TeamTag id={m.away} short /> · {lawLabel(d.law)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
