import { useState } from 'react'
import { useApp, href } from '../lib/useApp.jsx'
import { can, blockedReason } from '../lib/access.js'
import { VERDICTS } from '../lib/verdict.js'
import { LAW_AREAS } from '../data/seed.js'
import { ago, fmtDate, pct } from '../lib/format.js'
import * as store from '../lib/store.js'

export const lawLabel = (id) => LAW_AREAS.find((l) => l.id === id)?.label ?? id

export function TeamTag ({ id, short = false, link = true }) {
  const { team } = useApp()
  const t = team(id)
  if (!t) return null
  const inner = <><span className='dot' style={{ background: t.colour }} />{short ? t.short : t.name}</>
  return link ? <a className='team' href={href('team', t.id)}>{inner}</a> : <span className='team'>{inner}</span>
}

export function VerdictChip ({ review }) {
  if (!review) return <span className='chip'>Awaiting review</span>
  const v = VERDICTS[review.verdict] ?? VERDICTS.inconclusive
  return (
    <span className={`chip ${v.tone}`} title={`Confidence ${pct(review.confidence)}`}>
      {v.label}{review.verdict !== 'inconclusive' && review.confidence ? ` · ${pct(review.confidence)}` : ''}
    </span>
  )
}

export function SourceChip ({ review }) {
  if (!review) return null
  const map = { demo: 'Sample review', ai: 'AI review', offline: 'Offline preview', desk: 'Desk-adopted AI review' }
  return <span className='chip'>{map[review.source] ?? review.source}</span>
}

/** Shown in place of a control the member cannot use. */
export function Gate ({ action, children }) {
  const { user } = useApp()
  if (can(user, action)) return children
  return (
    <div className='gate'>
      <span className='sec small'>{blockedReason(user, action)}</span>
      <a className='btn primary small' href={href('account')}>{user ? 'Upgrade' : 'Join free'}</a>
    </div>
  )
}

export function Kpi ({ value, label }) {
  return <div className='kpi'><div className='v'>{value}</div><div className='l'>{label}</div></div>
}

export function Meter ({ value }) {
  return <div className='meter'><i style={{ width: `${Math.round((value ?? 0) * 100)}%` }} /></div>
}

export function FixtureCard ({ m }) {
  const { decisions } = useApp()
  const ds = decisions.filter((d) => d.matchId === m.id)
  const bad = ds.filter((d) => d.review?.verdict === 'incorrect').length
  return (
    <a className='card fixture-card' href={href('match', m.id)}>
      <div className='row between small muted' style={{ marginBottom: 8 }}>
        <span>{m.competition}</span><span>{fmtDate(m.kickoff)}</span>
      </div>
      <div className='fixture'>
        <span className='row'><TeamTag id={m.home} link={false} /></span>
        <span className='score'>{m.score.home.points}–{m.score.away.points}</span>
        <span className='row away'><TeamTag id={m.away} link={false} /></span>
      </div>
      <div className='row small muted' style={{ marginTop: 10 }}>
        <span>{ds.length} key decisions</span>
        {bad > 0 && <span className='chip bad'>{bad} contradicted</span>}
      </div>
    </a>
  )
}

export function VoteButtons ({ decision }) {
  const { user } = useApp()
  const mine = user ? store.myVote(user.id, decision.id) : null
  const allowed = can(user, 'vote')
  const total = decision.votes.agree + decision.votes.disagree
  const cast = (v) => allowed && store.vote(user.id, decision.id, v)
  return (
    <div className='vote small' title={allowed ? '' : blockedReason(user, 'vote')}>
      <span className='muted'>Supporters:</span>
      <button className={`btn small ${mine === 'agree' ? 'on' : ''}`} disabled={!allowed} onClick={() => cast('agree')}>Agree with the call {decision.votes.agree}</button>
      <button className={`btn small ${mine === 'disagree' ? 'on' : ''}`} disabled={!allowed} onClick={() => cast('disagree')}>Disagree {decision.votes.disagree}</button>
      {total > 0 && <span className='muted'>{pct(decision.votes.agree / total)} agree</span>}
    </div>
  )
}

export function Discussion ({ matchId, decisionId = null, title = 'Discussion' }) {
  const { state, user, userById } = useApp()
  const [body, setBody] = useState('')
  const [error, setError] = useState(null)
  const moderator = can(user, 'moderate')
  const posts = state.posts
    .filter((p) => p.matchId === matchId && (decisionId ? p.decisionId === decisionId : true))
    .filter((p) => !p.hidden || moderator)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const submit = (e) => {
    e.preventDefault()
    try {
      store.addPost({ userId: user.id, matchId, decisionId, body })
      setBody('')
      setError(null)
    } catch (err) { setError(err.message) }
  }

  return (
    <div className='card'>
      <h2>{title} <span className='muted small'>({posts.length})</span></h2>
      {posts.length === 0 && <p className='muted'>No posts yet.</p>}
      {posts.map((p) => {
        const u = userById(p.userId)
        return (
          <div key={p.id} className={`post ${p.hidden ? 'hidden' : ''}`}>
            <div className='row small'>
              <strong>{u?.name ?? 'Former member'}</strong>
              {u && <TeamTag id={u.teamId} short />}
              {u?.role === 'admin' && <span className='chip accent'>Desk</span>}
              <span className='muted'>{ago(p.createdAt)}</span>
              {moderator && (
                <button className='btn small' style={{ marginLeft: 'auto' }} onClick={() => store.setPostHidden(p.id, !p.hidden)}>
                  {p.hidden ? 'Restore' : 'Hide'}
                </button>
              )}
            </div>
            <p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{p.body}</p>
          </div>
        )
      })}
      <div style={{ marginTop: 12 }}>
        <Gate action='post'>
          <form onSubmit={submit} className='stack'>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder='Critique the decision, not the person. Cite the law and the moment.' maxLength={2000} />
            {error && <div className='error'>{error}</div>}
            <div className='row between'>
              <span className='muted small'>Posting as {user?.name} · all teams welcome</span>
              <button className='btn primary' type='submit'>Post</button>
            </div>
          </form>
        </Gate>
      </div>
    </div>
  )
}

export function ReviewBody ({ review, frames }) {
  return (
    <div className='stack'>
      <div className='row'><VerdictChip review={review} /><SourceChip review={review} />{review.lawApplied && <span className='muted small'>{review.lawApplied}</span>}</div>
      {review.summary && <p>{review.summary}</p>}
      {review.reasoning && <p className='sec'>{review.reasoning}</p>}
      {review.observations?.length > 0 && (
        <ul className='small sec' style={{ margin: 0, paddingLeft: 18 }}>
          {review.observations.map((o, i) => <li key={i}>{o}</li>)}
        </ul>
      )}
      {review.limitations && <p className='small muted'><strong>What the footage can’t show:</strong> {review.limitations}</p>}
      {frames?.length > 0 && (
        <div className='frames'>
          {frames.map((f, i) => (
            <figure key={i} className={review.keyFrame === i ? 'key' : ''}>
              <img src={f.url} alt={`Frame ${i}`} />
              <figcaption>Frame {i} · {Number(f.t).toFixed(1)}s{review.keyFrame === i ? ' · key' : ''}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
