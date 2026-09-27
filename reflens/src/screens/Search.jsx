import { useApp, href } from '../lib/useApp.jsx'
import { search } from '../lib/search.js'

const LINK = {
  team: (r) => href('team', r.id),
  official: (r) => href('official', r.id),
  match: (r) => href('match', r.id),
  decision: (r) => href('match', r.matchId)
}
const KIND = { team: 'Team', official: 'Official', match: 'Match', decision: 'Decision' }

export default function Search ({ q }) {
  const { teams, matches, officials, decisions } = useApp()
  const results = search(q ?? '', { teams, matches, officials, decisions })
  return (
    <>
      <h1>Search</h1>
      <p className='sec'>{q ? <>{results.length} results for “{q}”</> : 'Search teams, games, referees, TMOs and decisions — try “scrum”, “Ireland New Zealand” or “red card”.'}</p>
      <div className='card'>
        {results.map((r) => (
          <a key={`${r.kind}-${r.id}`} href={LINK[r.kind](r)} className='post' style={{ display: 'block', color: 'inherit' }}>
            <div className='row'><span className='chip'>{KIND[r.kind]}</span><strong>{r.title}</strong></div>
            <div className='small muted'>{r.subtitle}</div>
          </a>
        ))}
        {q && !results.length && <p className='muted'>Nothing found.</p>}
      </div>
    </>
  )
}
