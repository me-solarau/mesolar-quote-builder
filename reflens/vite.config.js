import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * In production `api/review.js` is deployed as a serverless function (Vercel /
 * Netlify style `handler(req, res)`). In dev this plugin mounts the same
 * handler on the Vite server so `npm run dev` exercises the real AI path when
 * ANTHROPIC_API_KEY is set.
 */
function apiDevServer () {
  return {
    name: 'reflens-api',
    configureServer (server) {
      server.middlewares.use('/api/review', async (req, res) => {
        const { default: handler } = await server.ssrLoadModule('/api/review.js')
        const chunks = []
        for await (const c of req) chunks.push(c)
        try { req.body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { req.body = null }
        res.status = (code) => { res.statusCode = code; return res }
        res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) }
        await handler(req, res)
      })
    }
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), apiDevServer()],
    build: { outDir: 'dist', sourcemap: false }
  }
})
