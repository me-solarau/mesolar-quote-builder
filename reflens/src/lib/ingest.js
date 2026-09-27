/**
 * Weekly round import.
 *
 * Every week the desk (or a scheduled job pulling from a results provider)
 * posts one JSON document per round. This validates it and turns it into the
 * same match/decision records the seed data uses. Nothing is partially
 * imported: any error rejects the whole round.
 *
 * {
 *   "round": { "id": "w5", "label": "Week 5", "date": "2026-10-03" },
 *   "matches": [{
 *     "home": "irl", "away": "arg", "kickoff": "2026-10-03T15:10:00Z",
 *     "competition": "Autumn Nations Series", "venue": "Dublin",
 *     "score": { "home": { "tries": 3, "conversions": 3, "penalties": 2, "dropGoals": 0 },
 *                "away": { "tries": 2, "conversions": 1, "penalties": 3, "dropGoals": 0 } },
 *     "officials": { "referee": "r2", "tmo": "t1" },
 *     "footageUrl": "https://licensed-highlights.example/...",
 *     "stats": { "home": { ... }, "away": { ... } },
 *     "decisions": [{ "minute": 34, "call": "Try awarded", "law": "scoring",
 *                     "by": "tmo", "against": "arg", "detail": "..." }]
 *   }]
 * }
 */

import { LAW_AREAS } from '../data/seed.js'

const points = (s) => s.tries * 5 + s.conversions * 2 + s.penalties * 3 + (s.dropGoals ?? 0) * 3

export function validateRound (doc, { teams, officials, existingMatchIds = [] }) {
  const errors = []
  const err = (where, msg) => errors.push(`${where}: ${msg}`)
  const teamIds = new Set(teams.map((t) => t.id))
  const offById = new Map(officials.map((o) => [o.id, o]))
  const laws = new Set(LAW_AREAS.map((l) => l.id))

  if (!doc || typeof doc !== 'object') return { ok: false, errors: ['Document is not a JSON object'] }
  const round = doc.round
  if (!round?.id || !round?.label || !/^\d{4}-\d{2}-\d{2}$/.test(round?.date ?? '')) err('round', 'needs id, label and date (YYYY-MM-DD)')
  if (!Array.isArray(doc.matches) || !doc.matches.length) err('matches', 'at least one match is required')

  const matches = []
  const decisions = []
  const seen = new Set(existingMatchIds)

  ;(doc.matches ?? []).forEach((m, i) => {
    const at = `matches[${i}]`
    if (!teamIds.has(m.home)) err(at, `unknown home team "${m.home}"`)
    if (!teamIds.has(m.away)) err(at, `unknown away team "${m.away}"`)
    if (m.home === m.away) err(at, 'a team cannot play itself')
    if (Number.isNaN(Date.parse(m.kickoff))) err(at, 'kickoff must be an ISO date-time')
    for (const s of ['home', 'away']) {
      const sc = m.score?.[s]
      if (!sc || ['tries', 'conversions', 'penalties'].some((k) => !Number.isInteger(sc[k]) || sc[k] < 0)) {
        err(at, `score.${s} needs non-negative integer tries, conversions, penalties`)
      } else if (sc.conversions > sc.tries) {
        err(at, `score.${s} has more conversions than tries`)
      } else if (sc.points != null && sc.points !== points(sc)) {
        err(at, `score.${s}.points is ${sc.points} but the components add to ${points(sc)}`)
      }
    }
    const ref = offById.get(m.officials?.referee)
    const tmo = offById.get(m.officials?.tmo)
    if (ref?.role !== 'referee') err(at, `officials.referee "${m.officials?.referee}" is not a known referee`)
    if (tmo?.role !== 'tmo') err(at, `officials.tmo "${m.officials?.tmo}" is not a known TMO`)
    if (m.footageUrl && !/^https:\/\//.test(m.footageUrl)) err(at, 'footageUrl must be https')

    const id = `${round?.id}-${m.home}-${m.away}`
    if (seen.has(id)) err(at, `match ${id} already exists`)
    seen.add(id)

    ;(m.decisions ?? []).forEach((d, k) => {
      const dat = `${at}.decisions[${k}]`
      if (!Number.isInteger(d.minute) || d.minute < 0 || d.minute > 120) err(dat, 'minute must be 0–120')
      if (!d.call) err(dat, 'call is required')
      if (!laws.has(d.law)) err(dat, `unknown law area "${d.law}"`)
      if (!['referee', 'tmo'].includes(d.by)) err(dat, 'by must be "referee" or "tmo"')
      if (d.against && d.against !== m.home && d.against !== m.away) err(dat, 'against must be one of the two teams')
      decisions.push({
        id: `${id}-d${k + 1}`, matchId: id, minute: d.minute, call: d.call, law: d.law,
        detail: d.detail ?? '', officialId: d.by === 'tmo' ? m.officials?.tmo : m.officials?.referee,
        against: d.against ?? null, review: null, votes: { agree: 0, disagree: 0 }
      })
    })

    const withPoints = (sc) => sc && { dropGoals: 0, ...sc, points: points({ dropGoals: 0, ...sc }) }
    matches.push({
      id, roundId: round?.id, competition: m.competition ?? 'International', kickoff: m.kickoff,
      venue: m.venue ?? '', home: m.home, away: m.away,
      score: { home: withPoints(m.score?.home), away: withPoints(m.score?.away) },
      stats: m.stats ?? null, officials: { referee: m.officials?.referee, tmo: m.officials?.tmo },
      footage: { source: m.footageUrl ? 'Licensed highlights' : 'Not linked', url: m.footageUrl ?? null }
    })
  })

  if (errors.length) return { ok: false, errors }
  return { ok: true, errors: [], round: { id: round.id, label: round.label, date: round.date }, matches, decisions }
}
