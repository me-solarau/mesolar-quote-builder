/**
 * Application state.
 *
 * No backend in this build: members, posts, votes, uploaded-evidence reviews
 * and imported rounds live in localStorage. The shape is the shape the
 * Postgres tables would have, so the swap to a real API is a transport change.
 *
 * Two things that must move server-side before launch, not just the storage:
 *  - the subscription check (see access.js) — today it trusts the browser;
 *  - evidence files — today only the extracted frames and the review are kept.
 */

import { SEED_USERS, SEED_POSTS, MATCHES, DECISIONS, ROUND_LIST } from '../data/seed.js'
import { renewUntil } from './access.js'

const KEY = 'reflens.state.v1'
const SESSION_KEY = 'reflens.session.v1'

const listeners = new Set()
let state = load()

function seed () {
  return {
    version: 1,
    users: SEED_USERS,
    posts: SEED_POSTS,
    votes: {},            // `${userId}:${decisionId}` -> 'agree' | 'disagree'
    evidence: [],         // supporter uploads + their AI reviews
    rounds: [],           // imported rounds (seed rounds are not stored)
    matches: [],          // imported matches
    decisions: [],        // imported decisions
    reviewOverrides: {},  // decisionId -> review (desk re-review of an official decision)
    payments: []
  }
}

function load () {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...seed(), ...JSON.parse(raw) }
  } catch { /* private mode or corrupted — fall through */ }
  return seed()
}

function save () {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* quota — keep in memory */ }
  for (const fn of listeners) fn()
}

export function subscribe (fn) { listeners.add(fn); return () => listeners.delete(fn) }
export function getState () { return state }
export function reset () { state = seed(); save() }

const id = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

/* ---------- data views (seed + imported) ---------- */

export function allRounds () { return [...ROUND_LIST, ...state.rounds] }
export function allMatches () { return [...MATCHES, ...state.matches] }
export function allDecisions () {
  const list = [...DECISIONS, ...state.decisions]
  return list.map((d) => {
    const extra = tallyVotes(d.id)
    return {
      ...d,
      review: state.reviewOverrides[d.id] ?? d.review,
      votes: { agree: (d.votes?.agree ?? 0) + extra.agree, disagree: (d.votes?.disagree ?? 0) + extra.disagree }
    }
  })
}

function tallyVotes (decisionId) {
  const t = { agree: 0, disagree: 0 }
  for (const [k, v] of Object.entries(state.votes)) if (k.endsWith(`:${decisionId}`)) t[v]++
  return t
}

/* ---------- session & membership ---------- */

export function getSessionUserId () {
  try { return localStorage.getItem(SESSION_KEY) } catch { return null }
}
export function setSessionUserId (uid) {
  try { uid ? localStorage.setItem(SESSION_KEY, uid) : localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
  for (const fn of listeners) fn()
}

export function register ({ name, email, teamId }) {
  const clean = String(email).trim().toLowerCase()
  if (!name?.trim()) throw new Error('Name is required')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error('Enter a valid email')
  if (!teamId) throw new Error('Pick the team you support')
  if (state.users.some((u) => u.email === clean)) throw new Error('That email is already registered — sign in instead')
  const user = { id: id('u'), name: name.trim(), email: clean, teamId, tier: 'free', subscribedUntil: null, role: 'supporter', createdAt: new Date().toISOString() }
  state = { ...state, users: [...state.users, user] }
  save()
  setSessionUserId(user.id)
  return user
}

export function signIn (email) {
  const u = state.users.find((x) => x.email === String(email).trim().toLowerCase())
  if (!u) throw new Error('No account with that email')
  setSessionUserId(u.id)
  return u
}

export function updateUser (uid, patch) {
  state = { ...state, users: state.users.map((u) => (u.id === uid ? { ...u, ...patch } : u)) }
  save()
}

/** Stand-in for the payment provider's webhook: record the charge, extend the membership. */
export function recordSubscriptionPayment (uid, { amount, currency, reference }) {
  const user = state.users.find((u) => u.id === uid)
  const until = renewUntil(user)
  state = {
    ...state,
    payments: [...state.payments, { id: id('pay'), userId: uid, amount, currency, reference, at: new Date().toISOString(), until }],
    users: state.users.map((u) => (u.id === uid ? { ...u, tier: 'supporter', subscribedUntil: until } : u))
  }
  save()
}

/* ---------- interaction ---------- */

export function addPost ({ userId, matchId, decisionId = null, evidenceId = null, body }) {
  const text = String(body ?? '').trim()
  if (!text) throw new Error('Write something first')
  if (text.length > 2000) throw new Error('Keep it under 2000 characters')
  const post = { id: id('p'), userId, matchId, decisionId, evidenceId, body: text, createdAt: new Date().toISOString(), hidden: false }
  state = { ...state, posts: [...state.posts, post] }
  save()
  return post
}

export function setPostHidden (postId, hidden) {
  state = { ...state, posts: state.posts.map((p) => (p.id === postId ? { ...p, hidden } : p)) }
  save()
}

/** One vote per member per decision; voting the same way again clears it. */
export function vote (userId, decisionId, value) {
  const k = `${userId}:${decisionId}`
  const votes = { ...state.votes }
  if (votes[k] === value) delete votes[k]
  else votes[k] = value
  state = { ...state, votes }
  save()
}
export function myVote (userId, decisionId) { return state.votes[`${userId}:${decisionId}`] ?? null }

export function addEvidence (rec) {
  const ev = { id: id('ev'), createdAt: new Date().toISOString(), feedback: [], ...rec }
  state = { ...state, evidence: [ev, ...state.evidence] }
  save()
  return ev
}
export function appendFeedback (evidenceId, entry) {
  state = { ...state, evidence: state.evidence.map((e) => (e.id === evidenceId ? { ...e, feedback: [...e.feedback, entry] } : e)) }
  save()
}

/** Desk adopts a supporter's evidence review as the decision's official RefLens review. */
export function adoptReview (decisionId, review) {
  state = { ...state, reviewOverrides: { ...state.reviewOverrides, [decisionId]: review } }
  save()
}

export function importRound ({ round, matches, decisions }) {
  state = { ...state, rounds: [...state.rounds, round], matches: [...state.matches, ...matches], decisions: [...state.decisions, ...decisions] }
  save()
}
