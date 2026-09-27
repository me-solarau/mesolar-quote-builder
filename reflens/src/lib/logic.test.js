import { test } from 'node:test'
import assert from 'node:assert/strict'

import { can, isSupporter, blockedReason, renewUntil, PRICE } from './access.js'
import { teamRecord, standings, officialScorecard, decisionImpact, winner } from './stats.js'
import { search } from './search.js'
import { validateRound } from './ingest.js'
import { normalizeReview } from './verdict.js'
import { TEAMS, OFFICIALS, MATCHES, DECISIONS } from '../data/seed.js'

const NOW = Date.parse('2026-09-27T00:00:00Z')
const free = { id: 'a', tier: 'free', role: 'supporter', subscribedUntil: null }
const paid = { id: 'b', tier: 'supporter', role: 'supporter', subscribedUntil: '2027-01-01T00:00:00Z' }
const lapsed = { id: 'c', tier: 'supporter', role: 'supporter', subscribedUntil: '2026-01-01T00:00:00Z' }
const admin = { id: 'd', tier: 'free', role: 'admin', subscribedUntil: null }

test('price is US$2.50 a year', () => {
  assert.equal(PRICE.amount, 2.5)
  assert.equal(PRICE.period, 'year')
})

test('free members and visitors can view but not interact', () => {
  for (const u of [null, free, lapsed]) {
    assert.equal(can(u, 'view', NOW), true)
    for (const a of ['post', 'reply', 'vote', 'upload', 'ai-review', 'ai-feedback']) assert.equal(can(u, a, NOW), false, a)
  }
})

test('active supporters can interact but not moderate', () => {
  for (const a of ['post', 'vote', 'upload', 'ai-review', 'ai-feedback']) assert.equal(can(paid, a, NOW), true)
  assert.equal(can(paid, 'moderate', NOW), false)
  assert.equal(can(paid, 'ingest', NOW), false)
})

test('admins can do everything', () => {
  assert.equal(isSupporter(admin, NOW), true)
  assert.equal(can(admin, 'ingest', NOW), true)
})

test('blocked reasons distinguish visitor, free and lapsed', () => {
  assert.match(blockedReason(null, 'post', NOW), /free account/)
  assert.match(blockedReason(free, 'post', NOW), /Upgrade/)
  assert.match(blockedReason(lapsed, 'post', NOW), /lapsed/)
  assert.equal(blockedReason(paid, 'post', NOW), null)
})

test('unknown actions throw rather than silently allow', () => {
  assert.throws(() => can(paid, 'delete-everything', NOW))
})

test('early renewal extends from current expiry, not from today', () => {
  assert.equal(renewUntil(paid, NOW), '2028-01-01T00:00:00.000Z')
  assert.equal(renewUntil(free, NOW), '2027-09-27T00:00:00.000Z')
})

test('seed scores add up', () => {
  for (const m of MATCHES) {
    for (const s of ['home', 'away']) {
      const sc = m.score[s]
      assert.equal(sc.points, sc.tries * 5 + sc.conversions * 2 + sc.penalties * 3 + sc.dropGoals * 3)
      assert.ok(sc.conversions <= sc.tries)
    }
  }
})

test('officials are never from either team\'s union', () => {
  const byId = new Map(OFFICIALS.map((o) => [o.id, o]))
  for (const m of MATCHES) {
    for (const oid of [m.officials.referee, m.officials.tmo]) {
      const u = byId.get(oid).union
      assert.ok(u !== m.home && u !== m.away, `${m.id} ${oid}`)
    }
  }
})

test('team record is consistent with results', () => {
  const m = [
    { id: 'x1', home: 'nzl', away: 'aus', kickoff: '2026-01-01', score: { home: { points: 20, tries: 2 }, away: { points: 10, tries: 1 } } },
    { id: 'x2', home: 'rsa', away: 'nzl', kickoff: '2026-01-08', score: { home: { points: 15, tries: 1 }, away: { points: 15, tries: 2 } } },
    { id: 'x3', home: 'nzl', away: 'fra', kickoff: '2026-01-15', score: { home: { points: 3, tries: 0 }, away: { points: 7, tries: 1 } } }
  ]
  const r = teamRecord('nzl', m)
  assert.deepEqual([r.played, r.won, r.drawn, r.lost], [3, 1, 1, 1])
  assert.equal(r.pointsFor, 38)
  assert.equal(r.pointsAgainst, 32)
  assert.equal(r.triesFor, 4)
  assert.deepEqual(r.form, ['W', 'D', 'L'])
  assert.equal(winner(m[1]), null)
})

test('standings include every team that played, ordered by wins', () => {
  const s = standings(TEAMS, MATCHES)
  assert.equal(s.length, new Set(MATCHES.flatMap((m) => [m.home, m.away])).size)
  for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].won >= s[i].won)
})

test('scorecard: marginal is half, inconclusive is excluded', () => {
  const ds = [
    { officialId: 'r1', law: 'ruck', review: { verdict: 'correct' } },
    { officialId: 'r1', law: 'ruck', review: { verdict: 'marginal' } },
    { officialId: 'r1', law: 'scrum', review: { verdict: 'incorrect' } },
    { officialId: 'r1', law: 'scrum', review: { verdict: 'inconclusive' } },
    { officialId: 'r2', law: 'scrum', review: { verdict: 'incorrect' } },
    { officialId: 'r1', law: 'scrum', review: null }
  ]
  const c = officialScorecard('r1', ds, [])
  assert.equal(c.reviewed, 4)
  assert.equal(c.accuracy, 1.5 / 3)
  assert.equal(c.byLaw.scrum.incorrect, 1)
})

test('scorecard with nothing judged has no accuracy, not 0%', () => {
  const c = officialScorecard('r1', [{ officialId: 'r1', law: 'x', review: { verdict: 'inconclusive' } }], [])
  assert.equal(c.accuracy, null)
})

test('decision impact only counts that team\'s matches', () => {
  const matches = [{ id: 'm1', home: 'irl', away: 'nzl' }, { id: 'm2', home: 'fra', away: 'ita' }]
  const ds = [
    { matchId: 'm1', against: 'irl', review: { verdict: 'incorrect' } },
    { matchId: 'm1', against: 'nzl', review: { verdict: 'incorrect' } },
    { matchId: 'm1', against: 'irl', review: { verdict: 'correct' } },
    { matchId: 'm2', against: 'fra', review: { verdict: 'incorrect' } }
  ]
  assert.deepEqual(decisionImpact('irl', ds, matches), { against: 1, favour: 1, reviewed: 2 })
})

test('search finds teams, officials, matches and decisions', () => {
  const data = { teams: TEAMS, matches: MATCHES, officials: OFFICIALS, decisions: DECISIONS }
  assert.equal(search('new zealand', data)[0].kind, 'team')
  assert.equal(search('NZL', data)[0].id, 'nzl')
  assert.equal(search('aitken', data)[0].kind, 'official')
  assert.ok(search('ireland new zealand', data).some((r) => r.kind === 'match' && r.id === 'w4-irl-nzl'))
  assert.ok(search('high tackle', data).some((r) => r.kind === 'decision'))
  assert.deepEqual(search('   ', data), [])
  assert.deepEqual(search('zzzzqq', data), [])
})

const goodRound = () => ({
  round: { id: 'w5', label: 'Week 5', date: '2026-10-03' },
  matches: [{
    home: 'irl', away: 'arg', kickoff: '2026-10-03T15:10:00Z', competition: 'Autumn Nations Series', venue: 'Dublin',
    score: { home: { tries: 3, conversions: 3, penalties: 2 }, away: { tries: 2, conversions: 1, penalties: 3, dropGoals: 0 } },
    officials: { referee: 'r2', tmo: 't1' },
    decisions: [{ minute: 34, call: 'Try awarded', law: 'scoring', by: 'tmo', against: 'arg' }]
  }]
})

test('ingest accepts a valid round and computes points', () => {
  const r = validateRound(goodRound(), { teams: TEAMS, officials: OFFICIALS })
  assert.equal(r.ok, true, r.errors.join('\n'))
  assert.equal(r.matches[0].score.home.points, 27)
  assert.equal(r.matches[0].score.away.points, 21)
  assert.equal(r.decisions[0].officialId, 't1')
  assert.equal(r.decisions[0].review, null)
})

test('ingest rejects bad data and reports every problem', () => {
  const d = goodRound()
  d.matches[0].away = 'xxx'
  d.matches[0].score.home.points = 99
  d.matches[0].officials.tmo = 'r1'
  d.matches[0].decisions[0].law = 'vibes'
  const r = validateRound(d, { teams: TEAMS, officials: OFFICIALS })
  assert.equal(r.ok, false)
  // 'against: arg' also becomes invalid once arg is no longer in the match
  assert.equal(r.errors.length, 5, r.errors.join('\n'))
})

test('ingest rejects duplicates of existing matches', () => {
  const r = validateRound(goodRound(), { teams: TEAMS, officials: OFFICIALS, existingMatchIds: ['w5-irl-arg'] })
  assert.equal(r.ok, false)
})

test('normalizeReview clamps and defaults untrusted output', () => {
  const r = normalizeReview({ verdict: 'robbed', confidence: 85, keyFrame: 99, observations: 'x' }, 8)
  assert.equal(r.verdict, 'inconclusive')
  assert.equal(r.confidence, 0.85)
  assert.equal(r.keyFrame, null)
  assert.deepEqual(r.observations, [])
  assert.equal(normalizeReview(null).verdict, 'inconclusive')
})
