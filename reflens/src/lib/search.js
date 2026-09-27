/**
 * One search box across teams, matches, officials and decisions.
 * Scored, not filtered: every query term must hit somewhere, and hits in a
 * name weigh more than hits in a description.
 */

import { LAW_AREAS } from '../data/seed.js'

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function score (terms, fields) {
  let total = 0
  for (const term of terms) {
    let best = 0
    for (const [text, weight] of fields) {
      const t = norm(text)
      if (!t) continue
      if (t === term) best = Math.max(best, weight * 3)
      else if (t.split(/[^a-z0-9]+/).some((w) => w.startsWith(term))) best = Math.max(best, weight * 2)
      else if (t.includes(term)) best = Math.max(best, weight)
    }
    if (!best) return 0
    total += best
  }
  return total
}

export function search (query, { teams, matches, officials, decisions }, limit = 40) {
  const terms = norm(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  const team = (id) => teams.find((t) => t.id === id)
  const law = (id) => LAW_AREAS.find((l) => l.id === id)?.label
  const results = []

  for (const t of teams) {
    const s = score(terms, [[t.name, 5], [t.short, 5], [t.region, 1]])
    if (s) results.push({ kind: 'team', id: t.id, title: t.name, subtitle: t.region, score: s + 2 })
  }
  for (const o of officials) {
    const s = score(terms, [[o.name, 5], [o.role === 'tmo' ? 'tmo television match official' : 'referee', 2]])
    if (s) results.push({ kind: 'official', id: o.id, title: o.name, subtitle: o.role === 'tmo' ? 'TMO' : 'Referee', score: s + 1 })
  }
  for (const m of matches) {
    const h = team(m.home)
    const a = team(m.away)
    const s = score(terms, [[h.name, 4], [a.name, 4], [h.short, 4], [a.short, 4], [m.competition, 2], [m.venue, 1], [m.kickoff.slice(0, 10), 2]])
    if (s) results.push({ kind: 'match', id: m.id, title: `${h.name} ${m.score.home.points}–${m.score.away.points} ${a.name}`, subtitle: `${m.competition} · ${m.kickoff.slice(0, 10)}`, score: s })
  }
  for (const d of decisions) {
    const m = matches.find((x) => x.id === d.matchId)
    if (!m) continue
    const s = score(terms, [[d.call, 3], [law(d.law), 2], [d.detail, 1], [team(m.home).name, 1], [team(m.away).name, 1], [d.review?.verdict, 2]])
    if (s) results.push({ kind: 'decision', id: d.id, matchId: d.matchId, title: `${d.minute}′ ${d.call}`, subtitle: `${team(m.home).short} v ${team(m.away).short} · ${law(d.law) ?? d.law}`, score: s })
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}
