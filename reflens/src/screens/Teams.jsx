import { useApp, href } from '../lib/useApp.jsx'
import { TeamTag, FixtureCard, Kpi } from '../components/ui.jsx'
import { standings, teamRecord, decisionImpact } from '../lib/stats.js'
import { pct } from '../lib/format.js'

export function Teams () {
  const { teams, matches, state } = useApp()
  const rows = standings(teams, matches)
  const fans = (id) => state.users.filter((u) => u.teamId === id).length
  return (
    <>
      <h1>Teams</h1>
      <p className='sec'>Every international played on RefLens, ranked by wins then points difference.</p>
      <div className='card table-wrap'>
        <table>
          <thead>
            <tr><th>#</th><th>Team</th><th className='n'>P</th><th className='n'>W</th><th className='n'>D</th><th className='n'>L</th><th className='n'>PF</th><th className='n'>PA</th><th className='n'>Diff</th><th className='n'>Tries</th><th>Form</th><th className='n'>Members</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.teamId}>
                <td className='muted'>{i + 1}</td>
                <td><TeamTag id={r.teamId} /></td>
                <td className='n'>{r.played}</td><td className='n'>{r.won}</td><td className='n'>{r.drawn}</td><td className='n'>{r.lost}</td>
                <td className='n'>{r.pointsFor}</td><td className='n'>{r.pointsAgainst}</td>
                <td className='n'>{r.pointsDiff > 0 ? '+' : ''}{r.pointsDiff}</td><td className='n'>{r.triesFor}</td>
                <td className='num small'>{r.form.join(' ')}</td>
                <td className='n'>{fans(r.teamId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function Team ({ id }) {
  const { team, matches, decisions, state } = useApp()
  const t = team(id)
  if (!t) return <p>Team not found. <a href={href('teams')}>All teams</a></p>
  const r = teamRecord(id, matches)
  const impact = decisionImpact(id, decisions, matches)
  const games = matches.filter((m) => m.home === id || m.away === id)
  const members = state.users.filter((u) => u.teamId === id).length
  return (
    <>
      <div className='row' style={{ marginBottom: 12 }}>
        <span className='dot' style={{ background: t.colour, width: 18, height: 18 }} />
        <h1 style={{ margin: 0 }}>{t.name}</h1>
        <span className='chip'>{t.region}</span>
        <span className='chip accent'>{members} members</span>
      </div>
      <div className='card grid g4'>
        <Kpi value={`${r.won}-${r.drawn}-${r.lost}`} label='Won-drawn-lost' />
        <Kpi value={`${r.pointsDiff > 0 ? '+' : ''}${r.pointsDiff}`} label='Points difference' />
        <Kpi value={r.triesFor} label='Tries scored' />
        <Kpi value={pct(r.tackleSuccess)} label='Tackle success' />
        <Kpi value={pct(r.avgPossession / 100)} label='Avg possession' />
        <Kpi value={Math.round(r.avgMetres ?? 0)} label='Avg metres per game' />
        <Kpi value={(r.avgPenalties ?? 0).toFixed(1)} label='Penalties conceded / game' />
        <Kpi value={`${r.yellowCards} / ${r.redCards}`} label='Yellow / red cards' />
      </div>
      <div className='card'>
        <h2>Refereeing impact</h2>
        <p className='sec'>
          Of the calls in {t.name} games that the evidence contradicts, <strong>{impact.against}</strong> went against them
          and <strong>{impact.favour}</strong> went their way.
        </p>
        <p className='small muted'>Unofficial. Based on RefLens reviews of logged key decisions only, not every whistle.</p>
      </div>
      <div className='section'>
        <h2>Games</h2>
        <div className='grid g3'>{games.map((m) => <FixtureCard key={m.id} m={m} />)}</div>
      </div>
    </>
  )
}
