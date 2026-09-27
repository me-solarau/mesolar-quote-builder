/**
 * Derived statistics. Pure functions over matches and decisions so they can
 * move to the server (or a materialised view) unchanged.
 */

export function winner (m) {
  const h = m.score.home.points
  const a = m.score.away.points
  return h > a ? m.home : a > h ? m.away : null
}

function side (m, teamId) {
  return m.home === teamId ? 'home' : m.away === teamId ? 'away' : null
}

export function teamRecord (teamId, matches) {
  const rec = {
    teamId, played: 0, won: 0, drawn: 0, lost: 0,
    pointsFor: 0, pointsAgainst: 0, triesFor: 0, triesAgainst: 0,
    possession: 0, metres: 0, tackles: 0, missedTackles: 0,
    penaltiesConceded: 0, yellowCards: 0, redCards: 0, form: []
  }
  const games = matches.filter((m) => side(m, teamId)).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  for (const m of games) {
    const us = side(m, teamId)
    const them = us === 'home' ? 'away' : 'home'
    rec.played++
    rec.pointsFor += m.score[us].points
    rec.pointsAgainst += m.score[them].points
    rec.triesFor += m.score[us].tries
    rec.triesAgainst += m.score[them].tries
    const s = m.stats?.[us]
    if (s) {
      rec.possession += s.possession
      rec.metres += s.metres
      rec.tackles += s.tackles
      rec.missedTackles += s.missedTackles
      rec.penaltiesConceded += s.penaltiesConceded
      rec.yellowCards += s.yellowCards
      rec.redCards += s.redCards
    }
    const w = winner(m)
    const r = w === teamId ? 'W' : w === null ? 'D' : 'L'
    if (r === 'W') rec.won++
    else if (r === 'D') rec.drawn++
    else rec.lost++
    rec.form.push(r)
  }
  const n = rec.played || 1
  rec.pointsDiff = rec.pointsFor - rec.pointsAgainst
  rec.avgPossession = rec.played ? rec.possession / n : null
  rec.avgMetres = rec.played ? rec.metres / n : null
  rec.tackleSuccess = rec.tackles + rec.missedTackles ? rec.tackles / (rec.tackles + rec.missedTackles) : null
  rec.avgPenalties = rec.played ? rec.penaltiesConceded / n : null
  return rec
}

export function standings (teams, matches) {
  return teams
    .map((t) => teamRecord(t.id, matches))
    .filter((r) => r.played > 0)
    .sort((a, b) => b.won - a.won || b.pointsDiff - a.pointsDiff || b.triesFor - a.triesFor)
}

/**
 * Accuracy for one official, from reviewed decisions.
 *
 * Correct counts 1, marginal counts ½ (a defensible call is not an error),
 * incorrect 0. Inconclusive reviews are excluded entirely — if the footage
 * cannot settle it, it is not evidence against the official.
 */
export function officialScorecard (officialId, decisions, matches) {
  const mine = decisions.filter((d) => d.officialId === officialId && d.review)
  const card = { officialId, reviewed: mine.length, correct: 0, marginal: 0, incorrect: 0, inconclusive: 0, byLaw: {}, agree: 0, disagree: 0 }
  for (const d of mine) {
    card[d.review.verdict]++
    const l = (card.byLaw[d.law] ??= { correct: 0, marginal: 0, incorrect: 0, inconclusive: 0 })
    l[d.review.verdict]++
    card.agree += d.votes?.agree ?? 0
    card.disagree += d.votes?.disagree ?? 0
  }
  const judged = card.correct + card.marginal + card.incorrect
  card.accuracy = judged ? (card.correct + card.marginal / 2) / judged : null
  card.matches = matches.filter((m) => m.officials.referee === officialId || m.officials.tmo === officialId).length
  const votes = card.agree + card.disagree
  card.communityAgreement = votes ? card.agree / votes : null
  return card
}

/** Reviewed errors that went against a team vs in its favour. */
export function decisionImpact (teamId, decisions, matches) {
  const ours = new Set(matches.filter((m) => side(m, teamId)).map((m) => m.id))
  const out = { against: 0, favour: 0, reviewed: 0 }
  for (const d of decisions) {
    if (!d.review || d.review.verdict !== 'incorrect') continue
    if (!ours.has(d.matchId)) continue
    out.reviewed++
    if (d.against === teamId) out.against++
    else out.favour++
  }
  return out
}
