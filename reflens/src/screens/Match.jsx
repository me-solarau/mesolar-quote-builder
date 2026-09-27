import { useApp, href } from '../lib/useApp.jsx'
import { TeamTag, VerdictChip, SourceChip, VoteButtons, Discussion, ReviewBody, lawLabel } from '../components/ui.jsx'
import { fmtDateTime } from '../lib/format.js'

const STAT_ROWS = [
  ['possession', 'Possession %'], ['territory', 'Territory %'], ['carries', 'Carries'], ['metres', 'Metres made'],
  ['linebreaks', 'Line breaks'], ['tackles', 'Tackles made'], ['missedTackles', 'Missed tackles'],
  ['turnoversWon', 'Turnovers won'], ['penaltiesConceded', 'Penalties conceded'],
  ['scrumsWon', 'Scrums won'], ['lineoutsWon', 'Lineouts won'], ['yellowCards', 'Yellow cards'], ['redCards', 'Red cards']
]

function StatRow ({ label, h, a }) {
  const total = h + a || 1
  return (
    <div className='statrow'>
      <div className='lbl'>{label}</div>
      <span className='v'>{h}</span>
      <div className='bar' aria-hidden>
        <i style={{ width: `${(h / total) * 100}%`, background: 'var(--home)' }} />
        <i style={{ width: `${(a / total) * 100}%`, background: 'var(--away)' }} />
      </div>
      <span className='v r'>{a}</span>
    </div>
  )
}

export default function Match ({ id }) {
  const { matches, decisions, official, state } = useApp()
  const m = matches.find((x) => x.id === id)
  if (!m) return <p>Match not found. <a href={href('home')}>Back to results</a></p>
  const ds = decisions.filter((d) => d.matchId === m.id)
  const evidence = state.evidence.filter((e) => e.matchId === m.id)
  const ref = official(m.officials.referee)
  const tmo = official(m.officials.tmo)

  return (
    <>
      <div className='card'>
        <div className='row between small muted'><span>{m.competition} · {m.venue}</span><span>{fmtDateTime(m.kickoff)}</span></div>
        <div className='fixture' style={{ margin: '14px 0' }}>
          <span className='row'><TeamTag id={m.home} /></span>
          <span className='score' style={{ fontSize: '2.2rem' }}>{m.score.home.points}–{m.score.away.points}</span>
          <span className='row away'><TeamTag id={m.away} /></span>
        </div>
        <div className='row small sec'>
          <span>Tries {m.score.home.tries}–{m.score.away.tries}</span>
          <span>· Pens {m.score.home.penalties}–{m.score.away.penalties}</span>
          <span>· Referee <a href={href('official', ref.id)}>{ref.name}</a></span>
          <span>· TMO <a href={href('official', tmo.id)}>{tmo.name}</a></span>
          {m.footage?.url && <span>· <a href={m.footage.url} target='_blank' rel='noreferrer'>Watch highlights</a></span>}
        </div>
      </div>

      <div className='grid g2 section' style={{ alignItems: 'start' }}>
        <div className='card'>
          <div className='row between'><h2>Key decisions</h2><a className='btn small' href={href('evidence', 'new', m.id)}>Upload evidence</a></div>
          {ds.length === 0 && <p className='muted'>No decisions logged for this match yet.</p>}
          {ds.map((d) => (
            <div key={d.id} className='decision' id={d.id}>
              <div className='minute'>{d.minute}′</div>
              <div className='stack'>
                <div>
                  <div className='row'><strong>{d.call}</strong><VerdictChip review={d.review} /><SourceChip review={d.review} /></div>
                  <div className='small muted'>{lawLabel(d.law)} · {official(d.officialId)?.role === 'tmo' ? 'TMO' : 'Referee'} {official(d.officialId)?.name}{d.against && <> · against <TeamTag id={d.against} short /></>}</div>
                </div>
                {d.detail && <p className='small sec' style={{ margin: 0 }}>{d.detail}</p>}
                {d.review && <details><summary className='small'>Why</summary><div style={{ marginTop: 8 }}><ReviewBody review={d.review} /></div></details>}
                <VoteButtons decision={d} />
              </div>
            </div>
          ))}
        </div>

        <div className='card'>
          <h2>Match stats</h2>
          <div className='row between small' style={{ marginBottom: 6 }}>
            <span className='row'><span className='dot' style={{ background: 'var(--home)' }} /><TeamTag id={m.home} short link={false} /></span>
            <span className='row'><TeamTag id={m.away} short link={false} /><span className='dot' style={{ background: 'var(--away)' }} /></span>
          </div>
          {m.stats
            ? STAT_ROWS.map(([k, label]) => <StatRow key={k} label={label} h={m.stats.home[k]} a={m.stats.away[k]} />)
            : <p className='muted'>Detailed stats not supplied for this match.</p>}
        </div>
      </div>

      {evidence.length > 0 && (
        <div className='card section'>
          <h2>Supporter evidence</h2>
          {evidence.map((e) => (
            <div key={e.id} className='decision'>
              <div className='minute'>{e.minute}′</div>
              <div>
                <div className='row'><a href={href('evidence', e.id)}><strong>{e.call}</strong></a><VerdictChip review={e.review} /></div>
                <div className='small muted'>{lawLabel(e.law)} · {e.frames.length} frames</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className='section'>
        <Discussion matchId={m.id} title='Match discussion' />
      </div>
    </>
  )
}
