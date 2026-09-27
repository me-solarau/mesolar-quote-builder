import { useEffect, useRef, useState } from 'react'
import { useApp, href, useRoute } from '../lib/useApp.jsx'
import { Gate, ReviewBody, TeamTag, VerdictChip, lawLabel } from '../components/ui.jsx'
import { loadVideo, extractFrames, framesFromImages } from '../lib/frames.js'
import { requestReview, requestFeedback } from '../lib/review.js'
import { can } from '../lib/access.js'
import { LAW_AREAS } from '../data/seed.js'
import { ago } from '../lib/format.js'
import * as store from '../lib/store.js'

/** Smaller copies for storage; the full-size frames only live for this session. */
function shrink (frames, width = 480) {
  return Promise.all(frames.map((f) => new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, width / img.width)
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * s)
      c.height = Math.round(img.height * s)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      const url = c.toDataURL('image/jpeg', 0.7)
      resolve({ t: f.t, url, data: url.slice(url.indexOf(',') + 1) })
    }
    img.src = f.url
  })))
}

function matchLabel (m, team) {
  return `${team(m.home).name} ${m.score.home.points}–${m.score.away.points} ${team(m.away).name}`
}

export function EvidenceList () {
  const { state, matches, team, user } = useApp()
  const mine = user ? state.evidence.filter((e) => e.userId === user.id) : []
  const others = state.evidence.filter((e) => e.userId !== user?.id)
  const Row = ({ e }) => {
    const m = matches.find((x) => x.id === e.matchId)
    return (
      <div className='decision'>
        <div className='minute'>{e.minute}′</div>
        <div>
          <div className='row'><a href={href('evidence', e.id)}><strong>{e.call}</strong></a><VerdictChip review={e.review} /></div>
          <div className='small muted'>{m ? matchLabel(m, team) : e.matchId} · {lawLabel(e.law)} · {ago(e.createdAt)}</div>
        </div>
      </div>
    )
  }
  return (
    <>
      <div className='row between'><h1>Evidence</h1><a className='btn primary' href={href('evidence', 'new')}>Upload evidence</a></div>
      <p className='sec'>
        Supporters upload their own clip or screenshots of a decision. The AI reviews it against the Laws of the Game
        and tells you what the footage does — and doesn’t — show. The video stays on your device; only still frames are sent.
      </p>
      {user && (
        <div className='card'><h2>Your uploads</h2>{mine.length ? mine.map((e) => <Row key={e.id} e={e} />) : <p className='muted'>Nothing yet.</p>}</div>
      )}
      <div className='card'><h2>From other supporters</h2>{others.length ? others.map((e) => <Row key={e.id} e={e} />) : <p className='muted'>No uploads yet.</p>}</div>
    </>
  )
}

export function EvidenceNew ({ matchId: initialMatch }) {
  const { matches, decisions, team, user, official } = useApp()
  const [, go] = useRoute()
  const [matchId, setMatchId] = useState(initialMatch ?? matches[0]?.id)
  const [decisionId, setDecisionId] = useState('')
  const [incident, setIncident] = useState({ minute: '', call: '', law: 'foul-play', by: 'referee' })
  const [note, setNote] = useState('')
  const [video, setVideo] = useState(null)
  const [range, setRange] = useState({ start: 0, end: 0, count: 8 })
  const [frames, setFrames] = useState([])
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const videoRef = useRef(null)

  const m = matches.find((x) => x.id === matchId)
  const ds = decisions.filter((d) => d.matchId === matchId)
  const decision = ds.find((d) => d.id === decisionId)

  useEffect(() => () => { if (videoRef.current) URL.revokeObjectURL(videoRef.current.src) }, [])

  const onFile = async (e) => {
    const files = [...e.target.files]
    setError(null); setFrames([]); setVideo(null)
    if (!files.length) return
    try {
      if (files[0].type.startsWith('video/')) {
        const v = await loadVideo(files[0])
        videoRef.current = v
        setVideo({ name: files[0].name, duration: v.duration })
        setRange({ start: 0, end: Math.min(v.duration, 8), count: 8 })
      } else if (files.every((f) => f.type.startsWith('image/'))) {
        if (files.length > 12) throw new Error('Up to 12 screenshots')
        setBusy('Reading images…')
        setFrames(await framesFromImages(files))
      } else {
        throw new Error('Choose a video, or up to 12 screenshots')
      }
    } catch (err) { setError(err.message) } finally { setBusy(null) }
  }

  const sample = async () => {
    setBusy('Extracting frames…'); setError(null)
    try { setFrames(await extractFrames(videoRef.current, range)) } catch (err) { setError(err.message) } finally { setBusy(null) }
  }

  const context = () => ({
    match: m ? `${matchLabel(m, team)} (${m.competition})` : '',
    minute: decision?.minute ?? incident.minute,
    call: decision?.call ?? incident.call,
    officialRole: decision ? official(decision.officialId)?.role : incident.by,
    lawLabel: lawLabel(decision?.law ?? incident.law),
    supporterTeam: team(user.teamId)?.name,
    note
  })

  const submit = async () => {
    const ctx = context()
    if (!ctx.call) return setError('Say what the decision on the field was')
    if (!frames.length) return setError('Add a clip or screenshots first')
    setBusy('AI is reviewing the frames… this can take a minute'); setError(null)
    try {
      const review = await requestReview(frames, ctx)
      const stored = await shrink(frames)
      const ev = store.addEvidence({
        userId: user.id, matchId, decisionId: decision?.id ?? null,
        minute: Number(ctx.minute) || 0, call: ctx.call, law: decision?.law ?? incident.law, officialRole: ctx.officialRole,
        note, frames: stored, review, context: ctx
      })
      go('evidence', ev.id)
    } catch (err) { setError(err.message) } finally { setBusy(null) }
  }

  return (
    <>
      <h1>Upload evidence</h1>
      <Gate action='upload'>
        <div className='card stack'>
          <label className='field'><span>Match</span>
            <select value={matchId} onChange={(e) => { setMatchId(e.target.value); setDecisionId('') }}>
              {matches.map((x) => <option key={x.id} value={x.id}>{matchLabel(x, team)} — {x.kickoff.slice(0, 10)}</option>)}
            </select>
          </label>
          <label className='field'><span>Decision</span>
            <select value={decisionId} onChange={(e) => setDecisionId(e.target.value)}>
              <option value=''>A decision that isn’t listed…</option>
              {ds.map((d) => <option key={d.id} value={d.id}>{d.minute}′ {d.call}</option>)}
            </select>
          </label>
          {!decision && (
            <div className='grid g4'>
              <label className='field'><span>Minute</span><input type='number' min='0' max='120' value={incident.minute} onChange={(e) => setIncident({ ...incident, minute: e.target.value })} /></label>
              <label className='field' style={{ gridColumn: 'span 2' }}><span>What was given</span><input type='text' placeholder='e.g. Try awarded, no card' value={incident.call} onChange={(e) => setIncident({ ...incident, call: e.target.value })} /></label>
              <label className='field'><span>By</span>
                <select value={incident.by} onChange={(e) => setIncident({ ...incident, by: e.target.value })}><option value='referee'>Referee</option><option value='tmo'>TMO</option></select>
              </label>
              <label className='field' style={{ gridColumn: '1 / -1' }}><span>Law area</span>
                <select value={incident.law} onChange={(e) => setIncident({ ...incident, law: e.target.value })}>{LAW_AREAS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
              </label>
            </div>
          )}
          <label className='field'><span>Your case (what you think the footage shows)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} placeholder='The AI treats this as a claim to check, not as evidence.' />
          </label>
          <label className='field'><span>Clip (MP4/WebM) or up to 12 screenshots</span>
            <input type='file' accept='video/*,image/*' multiple onChange={onFile} />
          </label>
          <p className='small muted'>Only upload footage you have the right to share. The video never leaves your device — RefLens sends still frames to the reviewer.</p>

          {video && (
            <div className='grid g4'>
              <label className='field'><span>From (s)</span><input type='number' step='0.1' min='0' max={video.duration} value={range.start} onChange={(e) => setRange({ ...range, start: Number(e.target.value) })} /></label>
              <label className='field'><span>To (s)</span><input type='number' step='0.1' min='0' max={video.duration} value={range.end} onChange={(e) => setRange({ ...range, end: Number(e.target.value) })} /></label>
              <label className='field'><span>Frames</span><input type='number' min='2' max='12' value={range.count} onChange={(e) => setRange({ ...range, count: Math.max(2, Math.min(12, Number(e.target.value))) })} /></label>
              <div style={{ alignSelf: 'end' }}><button className='btn' onClick={sample} disabled={!!busy}>Extract frames</button></div>
              <p className='small muted' style={{ gridColumn: '1 / -1' }}>{video.name} · {video.duration.toFixed(1)}s. Tighten the range around the incident — more frames across a shorter window gives the reviewer more to work with.</p>
            </div>
          )}

          {frames.length > 0 && (
            <div className='frames'>
              {frames.map((f, i) => <figure key={i}><img src={f.url} alt={`Frame ${i}`} /><figcaption>Frame {i} · {f.t.toFixed(1)}s</figcaption></figure>)}
            </div>
          )}

          {error && <div className='error'>{error}</div>}
          {busy && <div className='notice'>{busy}</div>}
          <div className='row'>
            <button className='btn primary' onClick={submit} disabled={!!busy || !frames.length}>Run AI review</button>
            <a className='btn' href={m ? href('match', m.id) : href('evidence')}>Cancel</a>
          </div>
        </div>
      </Gate>
    </>
  )
}

export function EvidenceDetail ({ id }) {
  const { state, matches, user, userById, decisions } = useApp()
  const e = state.evidence.find((x) => x.id === id)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  if (!e) return <p>Not found. <a href={href('evidence')}>All evidence</a></p>
  const m = matches.find((x) => x.id === e.matchId)
  const owner = userById(e.userId)
  const decision = decisions.find((d) => d.id === e.decisionId)

  const ask = async (ev) => {
    ev.preventDefault()
    if (!q.trim()) return
    setBusy(true); setError(null)
    try {
      const out = await requestFeedback(e.frames, e.context, e.review, q)
      store.appendFeedback(e.id, { userId: user.id, question: q, answer: out.answer, at: new Date().toISOString() })
      setQ('')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <>
      <div className='row' style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>{e.minute}′ {e.call}</h1>
      </div>
      <p className='small muted row'>
        {m && <><TeamTag id={m.home} short /> v <TeamTag id={m.away} short /> · <a href={href('match', m.id)}>Match page</a> ·</>}
        Uploaded by {owner?.name} {owner && <TeamTag id={owner.teamId} short />} · {ago(e.createdAt)}
      </p>
      {e.note && <div className='card'><h3>Supporter’s case</h3><p className='sec' style={{ whiteSpace: 'pre-wrap' }}>{e.note}</p></div>}
      <div className='card'>
        <h2>AI review</h2>
        <ReviewBody review={e.review} frames={e.frames} />
        {decision && can(user, 'moderate') && e.review.source === 'ai' && (
          <div className='row' style={{ marginTop: 12 }}>
            <button className='btn' onClick={() => store.adoptReview(decision.id, { ...e.review, source: 'desk', evidenceId: e.id })}>Adopt as this decision’s RefLens review</button>
          </div>
        )}
      </div>
      <div className='card'>
        <h2>Ask the reviewer</h2>
        <p className='small muted'>Push back, point to a frame, or ask what a law means here.</p>
        {e.feedback.map((f, i) => (
          <div key={i} className='post'>
            <div className='small'><strong>{userById(f.userId)?.name}:</strong> {f.question}</div>
            <p className='sec' style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{f.answer}</p>
          </div>
        ))}
        <Gate action='ai-feedback'>
          <form onSubmit={ask} className='stack' style={{ marginTop: 10 }}>
            <textarea value={q} onChange={(ev) => setQ(ev.target.value)} placeholder='e.g. In frame 4 his arm is tucked — doesn’t that count as mitigation?' maxLength={1500} />
            {error && <div className='error'>{error}</div>}
            <button className='btn primary' disabled={busy}>{busy ? 'Thinking…' : 'Ask'}</button>
          </form>
        </Gate>
      </div>
    </>
  )
}
