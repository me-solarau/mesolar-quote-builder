import { useState } from 'react'
import { useApp, href } from '../lib/useApp.jsx'
import { FixtureCard, TeamTag, VerdictChip, lawLabel } from '../components/ui.jsx'
import { PRICE } from '../lib/access.js'

export default function Home () {
  const { rounds, matches, decisions, user, team } = useApp()
  const latest = rounds[rounds.length - 1]
  const [roundId, setRoundId] = useState(latest?.id)
  const shown = matches.filter((m) => m.roundId === roundId)
  const flagged = decisions
    .filter((d) => d.review?.verdict === 'incorrect' && shown.some((m) => m.id === d.matchId))
    .slice(0, 6)

  return (
    <>
      <div className='card' style={{ marginBottom: 20 }}>
        <h1>Every big call, checked against the evidence.</h1>
        <p className='sec'>
          International rugby from around the world, uploaded every week. Results and stats for every game, and
          every key referee and TMO decision reviewed by AI against the footage and the Laws of the Game.
        </p>
        {!user && <p className='small'><a href={href('account')}>Join free</a> to follow your team. {PRICE.label} to post, vote and upload your own evidence.</p>}
        {user && <p className='small muted'>Signed in as {user.name}, supporting {team(user.teamId)?.name}.</p>}
      </div>

      <div className='tabs'>
        {rounds.map((r) => (
          <button key={r.id} className={`btn small ${r.id === roundId ? 'on' : ''}`} onClick={() => setRoundId(r.id)}>{r.label}</button>
        ))}
      </div>

      <div className='grid g3'>
        {shown.map((m) => <FixtureCard key={m.id} m={m} />)}
      </div>

      {flagged.length > 0 && (
        <div className='section'>
          <h2>Calls the evidence contradicts this week</h2>
          <div className='card'>
            {flagged.map((d) => {
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
        </div>
      )}
    </>
  )
}
