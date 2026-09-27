import { useState } from 'react'
import { useApp } from '../lib/useApp.jsx'
import { Gate } from '../components/ui.jsx'
import { validateRound } from '../lib/ingest.js'
import * as store from '../lib/store.js'

const EXAMPLE = JSON.stringify({
  round: { id: 'w5', label: 'Week 5', date: '2026-10-03' },
  matches: [{
    home: 'irl', away: 'arg', kickoff: '2026-10-03T15:10:00Z', competition: 'Autumn Nations Series', venue: 'Dublin',
    score: { home: { tries: 3, conversions: 3, penalties: 2, dropGoals: 0 }, away: { tries: 2, conversions: 1, penalties: 3, dropGoals: 0 } },
    officials: { referee: 'r2', tmo: 't1' },
    decisions: [{ minute: 34, call: 'Try awarded', law: 'scoring', by: 'tmo', against: 'arg', detail: 'Grounding on the line checked.' }]
  }]
}, null, 2)

export default function Admin () {
  const { teams, officials, matches, state } = useApp()
  const [text, setText] = useState(EXAMPLE)
  const [result, setResult] = useState(null)

  const check = () => {
    let doc
    try { doc = JSON.parse(text) } catch (e) { return setResult({ ok: false, errors: [`Invalid JSON: ${e.message}`] }) }
    setResult(validateRound(doc, { teams, officials, existingMatchIds: matches.map((m) => m.id) }))
  }
  const importIt = () => { store.importRound(result); setResult({ ...result, imported: true }) }

  return (
    <>
      <h1>Desk</h1>
      <Gate action='ingest'>
        <div className='card stack'>
          <h2>Import this week’s round</h2>
          <p className='small sec'>Paste the round feed. The whole round is rejected if anything fails validation. New decisions arrive “awaiting review”.</p>
          <textarea value={text} onChange={(e) => { setText(e.target.value); setResult(null) }} style={{ minHeight: 280, fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />
          <div className='row'>
            <button className='btn' onClick={check}>Validate</button>
            <button className='btn primary' onClick={importIt} disabled={!result?.ok || result.imported}>Import round</button>
          </div>
          {result && !result.ok && <ul className='error'>{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          {result?.ok && <div className='notice'>{result.imported ? 'Imported.' : `Valid: ${result.matches.length} matches, ${result.decisions.length} decisions.`}</div>}
          <p className='small muted'>Official IDs: {officials.map((o) => `${o.id} ${o.name} (${o.role})`).join(' · ')}</p>
        </div>
        <div className='card'>
          <h2>Moderation</h2>
          <p className='small sec'>{state.posts.filter((p) => p.hidden).length} hidden posts. Hide or restore posts from any discussion — the button appears for desk members.</p>
          <button className='btn' onClick={() => { if (window.confirm('Reset all local preview data?')) store.reset() }}>Reset preview data</button>
        </div>
      </Gate>
    </>
  )
}
