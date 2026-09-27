/**
 * Pull still frames out of a video file in the browser.
 *
 * Only the frames leave the device — the video itself is never uploaded. That
 * keeps requests small and means we are not hosting broadcast footage.
 */

const MAX_WIDTH = 960

function seek (video, t) {
  return new Promise((resolve, reject) => {
    const done = () => { video.removeEventListener('seeked', done); resolve() }
    video.addEventListener('seeked', done)
    video.addEventListener('error', () => reject(new Error('Could not read this video')), { once: true })
    video.currentTime = t
  })
}

export function loadVideo (file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.src = URL.createObjectURL(file)
    video.addEventListener('loadedmetadata', () => resolve(video), { once: true })
    video.addEventListener('error', () => reject(new Error('This browser cannot decode that video. Try MP4 (H.264).')), { once: true })
  })
}

/** Evenly spaced frames across [start, end]. Returns [{ t, data (base64 jpeg), url }]. */
export async function extractFrames (video, { start = 0, end = video.duration, count = 8, quality = 0.8 } = {}) {
  const s = Math.max(0, Math.min(start, video.duration))
  const e = Math.max(s, Math.min(end, video.duration))
  const scale = Math.min(1, MAX_WIDTH / (video.videoWidth || MAX_WIDTH))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round((video.videoWidth || MAX_WIDTH) * scale)
  canvas.height = Math.round((video.videoHeight || 540) * scale)
  const ctx = canvas.getContext('2d')
  const frames = []
  const n = Math.max(1, count)
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? s : s + ((e - s) * i) / (n - 1)
    await seek(video, Math.min(t, video.duration - 0.01))
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const url = canvas.toDataURL('image/jpeg', quality)
    frames.push({ t, url, data: url.slice(url.indexOf(',') + 1) })
  }
  return frames
}

/** Frames from still images (screenshots) instead of video. */
export async function framesFromImages (files) {
  const out = []
  for (const [i, f] of [...files].entries()) {
    const url = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, MAX_WIDTH / img.width)
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        URL.revokeObjectURL(img.src)
        resolve(c.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = () => reject(new Error(`Could not read ${f.name}`))
      img.src = URL.createObjectURL(f)
    })
    out.push({ t: i, url, data: url.slice(url.indexOf(',') + 1) })
  }
  return out
}
