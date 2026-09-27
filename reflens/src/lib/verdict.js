/**
 * The shape of an AI review. Shared by the browser and api/review.js so both
 * sides agree on what a verdict is.
 */

export const VERDICTS = {
  correct: { label: 'Supported by evidence', tone: 'good' },
  marginal: { label: 'Marginal call', tone: 'warn' },
  incorrect: { label: 'Contradicted by evidence', tone: 'bad' },
  inconclusive: { label: 'Inconclusive footage', tone: 'muted' }
}

export const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'confidence', 'summary', 'observations', 'lawApplied', 'limitations', 'keyFrame'],
  properties: {
    verdict: { type: 'string', enum: Object.keys(VERDICTS) },
    confidence: { type: 'number' },
    summary: { type: 'string' },
    observations: { type: 'array', items: { type: 'string' } },
    lawApplied: { type: 'string' },
    limitations: { type: 'string' },
    keyFrame: { type: 'integer' }
  }
}

/** Coerce whatever came back into a safe, displayable review. */
export function normalizeReview (raw, frameCount = 0) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const verdict = Object.hasOwn(VERDICTS, r.verdict) ? r.verdict : 'inconclusive'
  let confidence = Number(r.confidence)
  if (!Number.isFinite(confidence)) confidence = 0
  if (confidence > 1) confidence = confidence / 100
  confidence = Math.max(0, Math.min(1, confidence))
  const keyFrame = Number.isInteger(r.keyFrame) && r.keyFrame >= 0 && r.keyFrame < frameCount ? r.keyFrame : null
  return {
    verdict,
    confidence: Math.round(confidence * 100) / 100,
    summary: String(r.summary ?? '').slice(0, 1200),
    observations: Array.isArray(r.observations) ? r.observations.map(String).slice(0, 10) : [],
    lawApplied: String(r.lawApplied ?? ''),
    limitations: String(r.limitations ?? ''),
    keyFrame
  }
}
