/**
 * Sample data.
 *
 * Teams are real national unions. Scores, stats and decisions are generated
 * deterministically so every screen has something to show — they are NOT real
 * results. Match officials are fictional on purpose: publishing a
 * performance score against a real, named referee needs real evidence behind
 * every decision, and sample data is not that.
 *
 * In production the weekly round arrives through the ingest feed
 * (src/lib/ingest.js) and replaces all of this.
 */

import { rng } from '../lib/rng.js'

export const TEAMS = [
  { id: 'nzl', name: 'New Zealand', short: 'NZL', colour: '#111111', region: 'Oceania' },
  { id: 'rsa', name: 'South Africa', short: 'RSA', colour: '#0a6b3a', region: 'Africa' },
  { id: 'irl', name: 'Ireland', short: 'IRL', colour: '#169b62', region: 'Europe' },
  { id: 'fra', name: 'France', short: 'FRA', colour: '#1d3b8c', region: 'Europe' },
  { id: 'eng', name: 'England', short: 'ENG', colour: '#c8102e', region: 'Europe' },
  { id: 'sco', name: 'Scotland', short: 'SCO', colour: '#1c3f94', region: 'Europe' },
  { id: 'wal', name: 'Wales', short: 'WAL', colour: '#d30731', region: 'Europe' },
  { id: 'ita', name: 'Italy', short: 'ITA', colour: '#0064aa', region: 'Europe' },
  { id: 'aus', name: 'Australia', short: 'AUS', colour: '#d4a300', region: 'Oceania' },
  { id: 'arg', name: 'Argentina', short: 'ARG', colour: '#5ea9dd', region: 'Americas' },
  { id: 'fij', name: 'Fiji', short: 'FIJ', colour: '#3a8fd1', region: 'Oceania' },
  { id: 'jpn', name: 'Japan', short: 'JPN', colour: '#bc002d', region: 'Asia' },
  { id: 'geo', name: 'Georgia', short: 'GEO', colour: '#a4161a', region: 'Europe' },
  { id: 'sam', name: 'Samoa', short: 'SAM', colour: '#002b7f', region: 'Oceania' },
  { id: 'ton', name: 'Tonga', short: 'TGA', colour: '#c10000', region: 'Oceania' },
  { id: 'uru', name: 'Uruguay', short: 'URU', colour: '#4d9de0', region: 'Americas' },
  { id: 'por', name: 'Portugal', short: 'POR', colour: '#006600', region: 'Europe' },
  { id: 'usa', name: 'USA', short: 'USA', colour: '#3c3b6e', region: 'Americas' },
  { id: 'chi', name: 'Chile', short: 'CHI', colour: '#d52b1e', region: 'Americas' },
  { id: 'esp', name: 'Spain', short: 'ESP', colour: '#aa151b', region: 'Europe' }
]

/** Fictional officials. `union` is used to keep appointments neutral. */
export const OFFICIALS = [
  { id: 'r1', name: 'Callum Aitken', role: 'referee', union: 'sco' },
  { id: 'r2', name: 'Mathieu Roussel', role: 'referee', union: 'fra' },
  { id: 'r3', name: 'Tane Whitaker', role: 'referee', union: 'nzl' },
  { id: 'r4', name: 'Pieter Swanepoel', role: 'referee', union: 'rsa' },
  { id: 'r5', name: 'Declan Furey', role: 'referee', union: 'irl' },
  { id: 'r6', name: 'Owain Pritchard', role: 'referee', union: 'wal' },
  { id: 'r7', name: 'Santiago Vidal', role: 'referee', union: 'arg' },
  { id: 'r8', name: 'Hamish Carrow', role: 'referee', union: 'aus' },
  { id: 't1', name: 'Graham Lusk', role: 'tmo', union: 'eng' },
  { id: 't2', name: 'Bastien Carrère', role: 'tmo', union: 'fra' },
  { id: 't3', name: 'Rhys Madoc', role: 'tmo', union: 'wal' },
  { id: 't4', name: 'Kieran Doyle', role: 'tmo', union: 'irl' },
  { id: 't5', name: 'Leon du Toit', role: 'tmo', union: 'rsa' },
  { id: 't6', name: 'Marco Bellandi', role: 'tmo', union: 'ita' }
]

export const COMPETITIONS = {
  tests: 'Autumn Nations Series',
  rc: 'Rugby Championship',
  pnc: 'Pacific Nations Cup',
  rec: 'Rugby Europe Championship'
}

/** Law areas the AI reviewer and the upload form both use. */
export const LAW_AREAS = [
  { id: 'foul-play', label: 'Foul play (high tackle, dangerous play)' },
  { id: 'offside', label: 'Offside in open play' },
  { id: 'knock-on', label: 'Knock-on or throw forward' },
  { id: 'tackle', label: 'Tackle' },
  { id: 'ruck', label: 'Ruck' },
  { id: 'maul', label: 'Maul' },
  { id: 'scrum', label: 'Scrum' },
  { id: 'lineout', label: 'Lineout and touch' },
  { id: 'scoring', label: 'Scoring (grounding, in-goal)' },
  { id: 'advantage', label: 'Advantage and play-on' },
  { id: 'other', label: 'Other' }
]

const DECISION_TEMPLATES = [
  { law: 'scoring', call: 'Try awarded', by: 'tmo', detail: 'Grounding checked on replay; TMO confirmed downward pressure.' },
  { law: 'scoring', call: 'Try disallowed — held up', by: 'tmo', detail: 'TMO ruled the ball was held off the ground by a defender.' },
  { law: 'knock-on', call: 'Try disallowed — knock-on in build-up', by: 'tmo', detail: 'TMO found a knock-on two phases earlier.' },
  { law: 'knock-on', call: 'Forward pass — scrum', by: 'referee', detail: 'Referee blew for a forward pass on the wing.' },
  { law: 'foul-play', call: 'Yellow card — high tackle', by: 'tmo', detail: 'Head contact, mitigation for a late dip applied.' },
  { law: 'foul-play', call: 'Red card — high tackle', by: 'tmo', detail: 'Direct head contact, high degree of danger, no mitigation.' },
  { law: 'foul-play', call: 'No action — head contact reviewed', by: 'tmo', detail: 'Contact judged to be shoulder-to-chest; play on.' },
  { law: 'offside', call: 'Penalty — offside at the ruck', by: 'referee', detail: 'Defender in front of the hindmost foot.' },
  { law: 'ruck', call: 'Penalty — not releasing', by: 'referee', detail: 'Jackler judged to have lost his feet before the ball was released.' },
  { law: 'tackle', call: 'Penalty — holding on', by: 'referee', detail: 'Ball carrier did not place or release after the tackle.' },
  { law: 'scrum', call: 'Scrum penalty — collapsing', by: 'referee', detail: 'Loosehead penalised for driving in and down.' },
  { law: 'maul', call: 'Penalty try — maul collapsed', by: 'referee', detail: 'Defending maul pulled down five metres from the line.' },
  { law: 'lineout', call: 'Lineout — not straight', by: 'referee', detail: 'Throw judged crooked; scrum awarded.' },
  { law: 'advantage', call: 'Advantage over — no penalty', by: 'referee', detail: 'Referee called advantage over after a short kick.' }
]

const VERDICTS = ['correct', 'correct', 'correct', 'correct', 'marginal', 'incorrect', 'incorrect', 'inconclusive']

const REASONING = {
  correct: 'The footage supports the on-field call. The key frame shows the moment the law turns on, and nothing in the other angles contradicts it.',
  marginal: 'Defensible either way. The angle available leaves the critical moment within a frame or two, so the official’s view is reasonable but not clearly right.',
  incorrect: 'The evidence contradicts the call. The clearest angle shows the opposite of what was ruled, and it was available to the officials at the time.',
  inconclusive: 'The footage cannot settle it. The critical contact is obscured, so any verdict would be a guess.'
}

// Rounds: each week is a set of internationals. Start dates are Saturdays.
const ROUNDS = [
  { id: 'w1', label: 'Week 1', date: '2026-09-05', comp: 'rc' },
  { id: 'w2', label: 'Week 2', date: '2026-09-12', comp: 'pnc' },
  { id: 'w3', label: 'Week 3', date: '2026-09-19', comp: 'rec' },
  { id: 'w4', label: 'Week 4', date: '2026-09-26', comp: 'tests' }
]

const FIXTURES = {
  w1: [['nzl', 'aus'], ['rsa', 'arg'], ['fij', 'sam'], ['jpn', 'ton'], ['usa', 'chi'], ['uru', 'por']],
  w2: [['aus', 'rsa'], ['arg', 'nzl'], ['sam', 'jpn'], ['ton', 'fij'], ['geo', 'esp'], ['ita', 'uru']],
  w3: [['fra', 'ita'], ['sco', 'geo'], ['wal', 'por'], ['irl', 'jpn'], ['eng', 'fij'], ['esp', 'usa']],
  w4: [['irl', 'nzl'], ['fra', 'rsa'], ['eng', 'aus'], ['sco', 'arg'], ['wal', 'fij'], ['ita', 'geo']]
}

// Rough strength so results look like rugby, not coin flips.
const STRENGTH = { nzl: 92, rsa: 93, irl: 91, fra: 90, eng: 86, sco: 84, arg: 83, aus: 80, fij: 79, ita: 76, wal: 74, jpn: 74, geo: 72, sam: 68, ton: 66, por: 65, uru: 64, esp: 62, usa: 60, chi: 58 }

function genScore (r, rating) {
  const tries = Math.max(0, Math.round((rating - 55) / 9 + r() * 3 - 1))
  const conversions = Math.min(tries, Math.round(tries * (0.55 + r() * 0.35)))
  const penalties = Math.round(r() * 4)
  const dropGoals = r() < 0.08 ? 1 : 0
  return { tries, conversions, penalties, dropGoals, points: tries * 5 + conversions * 2 + penalties * 3 + dropGoals * 3 }
}

function genStats (r, won) {
  const possession = Math.round(42 + r() * 16 + (won ? 3 : -3))
  return {
    possession,
    territory: Math.round(40 + r() * 20 + (won ? 4 : -4)),
    carries: Math.round(95 + r() * 60),
    metres: Math.round(320 + r() * 380 + (won ? 60 : 0)),
    linebreaks: Math.round(2 + r() * 9),
    tackles: Math.round(110 + r() * 90),
    missedTackles: Math.round(10 + r() * 22),
    turnoversWon: Math.round(3 + r() * 8),
    penaltiesConceded: Math.round(7 + r() * 8),
    scrumsWon: Math.round(4 + r() * 6),
    scrumsLost: Math.round(r() * 3),
    lineoutsWon: Math.round(9 + r() * 8),
    lineoutsLost: Math.round(r() * 4),
    yellowCards: r() < 0.3 ? 1 : 0,
    redCards: r() < 0.05 ? 1 : 0
  }
}

function neutral (r, pool, home, away) {
  const ok = pool.filter((o) => o.union !== home && o.union !== away)
  return ok[Math.floor(r() * ok.length)]
}

function buildMatches () {
  const r = rng(20260905)
  const matches = []
  const decisions = []
  for (const round of ROUNDS) {
    FIXTURES[round.id].forEach(([home, away], i) => {
      const id = `${round.id}-${home}-${away}`
      const hs = genScore(r, STRENGTH[home] + 3 + r() * 10 - 5) // home advantage
      const as = genScore(r, STRENGTH[away] + r() * 10 - 5)
      const referee = neutral(r, OFFICIALS.filter((o) => o.role === 'referee'), home, away)
      const tmo = neutral(r, OFFICIALS.filter((o) => o.role === 'tmo'), home, away)
      const kickoff = `${round.date}T${String(13 + i).padStart(2, '0')}:00:00Z`
      matches.push({
        id,
        roundId: round.id,
        competition: COMPETITIONS[round.comp],
        kickoff,
        venue: `${TEAMS.find((t) => t.id === home).name} home test`,
        home,
        away,
        score: { home: hs, away: as },
        stats: { home: genStats(r, hs.points > as.points), away: genStats(r, as.points > hs.points) },
        officials: { referee: referee.id, tmo: tmo.id },
        footage: { source: 'Licensed highlights link (not hosted)', url: null }
      })

      const n = 4 + Math.floor(r() * 4)
      const used = new Set()
      for (let k = 0; k < n; k++) {
        let t
        do { t = Math.floor(r() * DECISION_TEMPLATES.length) } while (used.has(t) && used.size < DECISION_TEMPLATES.length)
        used.add(t)
        const tpl = DECISION_TEMPLATES[t]
        const verdict = VERDICTS[Math.floor(r() * VERDICTS.length)]
        const against = r() < 0.5 ? home : away
        decisions.push({
          id: `${id}-d${k + 1}`,
          matchId: id,
          minute: 3 + Math.floor(r() * 77),
          call: tpl.call,
          law: tpl.law,
          detail: tpl.detail,
          officialId: tpl.by === 'tmo' ? tmo.id : referee.id,
          against,
          review: {
            verdict,
            confidence: verdict === 'inconclusive' ? 0.3 : Math.round((0.6 + r() * 0.35) * 100) / 100,
            reasoning: REASONING[verdict],
            source: 'demo',
            reviewedAt: `${round.date}T22:00:00Z`
          },
          votes: { agree: Math.floor(r() * 400), disagree: Math.floor(r() * 250) }
        })
      }
    })
  }
  decisions.sort((a, b) => a.matchId.localeCompare(b.matchId) || a.minute - b.minute)
  return { matches, decisions }
}

const built = buildMatches()
export const MATCHES = built.matches
export const DECISIONS = built.decisions
export const ROUND_LIST = ROUNDS

export const SEED_USERS = [
  { id: 'u-demo-free', name: 'Aroha (free)', email: 'aroha@example.com', teamId: 'nzl', tier: 'free', subscribedUntil: null, role: 'supporter', createdAt: '2026-08-01T00:00:00Z' },
  { id: 'u-demo-paid', name: 'Siya (supporter)', email: 'siya@example.com', teamId: 'rsa', tier: 'supporter', subscribedUntil: '2027-08-01T00:00:00Z', role: 'supporter', createdAt: '2026-08-01T00:00:00Z' },
  { id: 'u-demo-admin', name: 'RefLens desk', email: 'desk@example.com', teamId: 'irl', tier: 'supporter', subscribedUntil: '2099-01-01T00:00:00Z', role: 'admin', createdAt: '2026-08-01T00:00:00Z' }
]

export const SEED_POSTS = [
  { id: 'p1', matchId: 'w4-irl-nzl', decisionId: null, userId: 'u-demo-paid', body: 'Neutral here. That breakdown in the second half was a lottery for both sides.', createdAt: '2026-09-26T21:10:00Z', hidden: false },
  { id: 'p2', matchId: 'w4-irl-nzl', decisionId: null, userId: 'u-demo-admin', body: 'Reminder: critique decisions, not people. Post the clip and the law — that is what moves the review.', createdAt: '2026-09-26T21:30:00Z', hidden: false },
  { id: 'p3', matchId: 'w4-fra-rsa', decisionId: null, userId: 'u-demo-paid', body: 'Scrum penalties went our way today but I can’t argue with the AI on the second one — we were driving in.', createdAt: '2026-09-26T22:05:00Z', hidden: false }
]
