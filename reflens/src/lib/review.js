/**
 * Browser side of the AI reviewer. Calls /api/review; if the server has no
 * API key (or there is no server, e.g. a static preview) it says so and
 * returns a clearly-labelled offline placeholder instead of pretending.
 */

import { normalizeReview } from './verdict.js'

async function post (body) {
  let res
  try {
    res = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    return { offline: true }
  }
  if (res.status === 404 || res.status === 503) return { offline: true }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `Review failed (${res.status})`)
  return json
}

const strip = (frames) => frames.map(({ t, data }) => ({ t, data }))

export async function requestReview (frames, context) {
  const out = await post({ mode: 'review', frames: strip(frames), context })
  if (out.offline) {
    return {
      ...normalizeReview({
        verdict: 'inconclusive',
        confidence: 0,
        summary: 'Offline preview: the AI reviewer is not connected on this deployment, so no judgement was made. Set ANTHROPIC_API_KEY on the server to enable real reviews.',
        observations: [`${frames.length} frames captured and ready to review.`],
        lawApplied: context.lawLabel ?? '',
        limitations: 'No analysis was performed.',
        keyFrame: 0
      }, frames.length),
      source: 'offline',
      reviewedAt: new Date().toISOString()
    }
  }
  return out.review
}

export async function requestFeedback (frames, context, review, question) {
  const out = await post({ mode: 'feedback', frames: strip(frames), context, review, question })
  if (out.offline) return { answer: 'Offline preview: the AI reviewer is not connected on this deployment.', offline: true }
  return out
}
