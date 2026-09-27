/**
 * POST /api/review — AI review of a refereeing decision from video frames.
 *
 * Body:
 *   { mode: 'review', frames: [{ t, data }], context: {...} }
 *   { mode: 'feedback', frames, context, review, question }
 * where `data` is a base64 JPEG (no data: prefix).
 *
 * Deployed as a serverless function; mounted on the Vite dev server by
 * vite.config.js. Needs ANTHROPIC_API_KEY.
 *
 * BEFORE LAUNCH: `authorize` below must check a real session and an active
 * supporter subscription on the server. Until it does, anyone who finds this
 * URL can spend your API credit.
 */

import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT, FEEDBACK_SYSTEM_PROMPT, PROMPT_VERSION, reviewUserText } from './_prompt.js'
import { REVIEW_SCHEMA, normalizeReview } from '../src/lib/verdict.js'

export const MODEL = 'claude-opus-5'
export const MAX_FRAMES = 12
const MAX_FRAME_BYTES = 1_500_000
const RATE = { windowMs: 60_000, max: 6 }

const hits = new Map()
function rateLimited (key, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE.windowMs)
  recent.push(now)
  hits.set(key, recent)
  return recent.length > RATE.max
}

// eslint-disable-next-line no-unused-vars
function authorize (req) {
  // Replace with: look up the session cookie, load the member, `can(member, 'ai-review')`.
  return { ok: true }
}

export function validateBody (body) {
  if (!body || typeof body !== 'object') return 'Body must be JSON'
  if (!['review', 'feedback'].includes(body.mode)) return 'mode must be "review" or "feedback"'
  if (!Array.isArray(body.frames) || body.frames.length === 0) return 'At least one frame is required'
  if (body.frames.length > MAX_FRAMES) return `At most ${MAX_FRAMES} frames`
  for (const f of body.frames) {
    if (typeof f?.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(f.data)) return 'Each frame needs base64 JPEG data'
    if (f.data.length > MAX_FRAME_BYTES) return 'A frame is too large — sample at a lower resolution'
  }
  if (!body.context || typeof body.context !== 'object') return 'context is required'
  if (body.mode === 'feedback' && !String(body.question ?? '').trim()) return 'question is required for feedback'
  return null
}

function frameBlocks (frames) {
  const out = []
  frames.forEach((f, i) => {
    out.push({ type: 'text', text: `Frame ${i} — t=${Number(f.t ?? 0).toFixed(2)}s` })
    out.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.data } })
  })
  return out
}

let client
const getClient = () => (client ??= new Anthropic())

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI review is not configured on this server', code: 'not_configured' })

  const auth = authorize(req)
  if (!auth.ok) return res.status(403).json({ error: 'Supporter membership required' })

  const ip = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many reviews — try again in a minute' })

  const body = req.body
  const invalid = validateBody(body)
  if (invalid) return res.status(400).json({ error: invalid })

  const frames = frameBlocks(body.frames)
  const common = {
    model: MODEL,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    cache_control: { type: 'ephemeral' }
  }

  try {
    if (body.mode === 'review') {
      const msg = await getClient().beta.messages.create({
        ...common,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        output_config: { effort: 'high', format: { type: 'json_schema', schema: REVIEW_SCHEMA } },
        messages: [{ role: 'user', content: [...frames, { type: 'text', text: reviewUserText(body.context) }] }]
      })
      if (msg.stop_reason === 'refusal') return res.status(422).json({ error: 'The reviewer declined this clip.' })
      if (msg.stop_reason === 'max_tokens') return res.status(502).json({ error: 'Review was cut off — try fewer frames.' })
      const text = msg.content.find((b) => b.type === 'text')?.text ?? '{}'
      const review = normalizeReview(JSON.parse(text), body.frames.length)
      return res.status(200).json({ review: { ...review, source: 'ai', model: msg.model, promptVersion: PROMPT_VERSION, reviewedAt: new Date().toISOString() } })
    }

    const msg = await getClient().beta.messages.create({
      ...common,
      max_tokens: 4000,
      system: FEEDBACK_SYSTEM_PROMPT,
      output_config: { effort: 'medium' },
      messages: [{
        role: 'user',
        content: [
          ...frames,
          { type: 'text', text: `${reviewUserText(body.context)}\n\nYour earlier review:\n${JSON.stringify(body.review)}\n\nSupporter's follow-up:\n"""${String(body.question).slice(0, 1500)}"""` }
        ]
      }]
    })
    if (msg.stop_reason === 'refusal') return res.status(422).json({ error: 'The reviewer declined this question.' })
    const answer = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
    return res.status(200).json({ answer, model: msg.model })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'AI reviewer is busy — try again shortly' })
    if (e instanceof Anthropic.BadRequestError) return res.status(400).json({ error: 'The clip could not be reviewed (bad frames or request).' })
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: 'AI reviewer unavailable' })
    if (e instanceof SyntaxError) return res.status(502).json({ error: 'AI reviewer returned an unreadable result' })
    throw e
  }
}
