const { rmSync } = require('fs')
const { spawn } = require('child_process')
const http = require('http')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function httpGet(path, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        timeout: timeoutMs,
      },
      (res) => {
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, body: data })
        })
      }
    )

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout requesting ${path}`))
    })
  })
}

async function warmUp() {
  const maxAttempts = 8
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const home = await httpGet('/')
      if (home.status >= 400) {
        throw new Error(`Home returned HTTP ${home.status}`)
      }

      const layoutChunkMatch = home.body.match(/\/_next\/static\/chunks\/app\/layout(?:\.[^"']+)?\.js/)
      const layoutChunkPath = layoutChunkMatch ? layoutChunkMatch[0] : '/_next/static/chunks/app/layout.js'
      const layout = await httpGet(`${layoutChunkPath}?warmup=${Date.now()}`)
      if (layout.status >= 400) {
        throw new Error(`${layoutChunkPath} returned HTTP ${layout.status}`)
      }

      console.log(`[DEV] Warm-up OK: / and ${layoutChunkPath}`)
      return
    } catch (error) {
      console.log(`[DEV] Warm-up intento ${attempt}/${maxAttempts} fallo: ${error.message}`)
      await sleep(1000)
    }
  }

  console.log('[DEV] Warm-up no completado, pero el servidor sigue en ejecucion.')
}

try {
  rmSync('.next', { recursive: true, force: true })
  console.log('[DEV] cache .next limpiado')
} catch (_) {
  // Ignore cleanup errors.
}

const nextBin = process.platform === 'win32' ? 'node_modules\\next\\dist\\bin\\next' : 'node_modules/next/dist/bin/next'
const child = spawn(process.execPath, [nextBin, 'dev'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: process.env,
})

let warmUpStarted = false

child.stdout.on('data', (chunk) => {
  const text = chunk.toString()
  process.stdout.write(text)

  if (!warmUpStarted && (text.includes('Ready in') || text.includes('ready - started server'))) {
    warmUpStarted = true
    warmUp().catch((error) => {
      console.log(`[DEV] Warm-up error: ${error.message}`)
    })
  }
})

child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk)
})

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal)
  }
}

process.on('SIGINT', () => forwardSignal('SIGINT'))
process.on('SIGTERM', () => forwardSignal('SIGTERM'))

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code || 0)
})
