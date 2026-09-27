import { test } from 'node:test'
import assert from 'node:assert/strict'
import handler, { validateBody, MAX_FRAMES } from './review.js'

const frame = { t: 0, data: 'QUJD' }
const ok = { mode: 'review', frames: [frame], context: { call: 'Try awarded' } }

test('validateBody accepts a minimal review', () => {
  assert.equal(validateBody(ok), null)
})

test('validateBody rejects bad input', () => {
  assert.match(validateBody(null), /JSON/)
  assert.match(validateBody({ ...ok, mode: 'x' }), /mode/)
  assert.match(validateBody({ ...ok, frames: [] }), /frame/)
  assert.match(validateBody({ ...ok, frames: Array(MAX_FRAMES + 1).fill(frame) }), /At most/)
  assert.match(validateBody({ ...ok, frames: [{ data: 'data:image/jpeg;base64,AAA' }] }), /base64/)
  assert.match(validateBody({ ...ok, mode: 'feedback' }), /question/)
})

function mockRes () {
  const res = { code: 0, body: null }
  res.status = (c) => { res.code = c; return res }
  res.json = (b) => { res.body = b; return res }
  return res
}

test('handler refuses non-POST and reports when not configured', async () => {
  const saved = process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  let res = mockRes()
  await handler({ method: 'GET' }, res)
  assert.equal(res.code, 405)
  res = mockRes()
  await handler({ method: 'POST', body: ok, headers: {} }, res)
  assert.equal(res.code, 503)
  assert.equal(res.body.code, 'not_configured')
  if (saved) process.env.ANTHROPIC_API_KEY = saved
})
