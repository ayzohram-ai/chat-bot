import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn, ChildProcess, execSync } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'

const isWin = process.platform === 'win32'
const pathSep = isWin ? ';' : ':'

let mainWindow: BrowserWindow | null = null

// ---------------------------------------------------------------------------
// Module-level state — updated by validateClaude()
// ---------------------------------------------------------------------------
interface ValidateResult {
  ok: boolean
  bin: string
  version: string
  error?: string
}

let mergedEnv: Record<string, string> = { ...process.env } as Record<string, string>
let claudeBin = 'claude'
let claudeShell: string | true = true
let validateResult: ValidateResult | null = null

// ---------------------------------------------------------------------------
// 1. Build a merged PATH from ALL shells + common install locations
// ---------------------------------------------------------------------------
function buildMergedEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>
  const home = os.homedir()
  const extraPaths: string[] = []

  if (isWin) {
    // Collect from cmd
    try {
      const raw = execSync('cmd.exe /c "echo %PATH%"', { encoding: 'utf-8', timeout: 5000 }).trim()
      if (raw && !raw.includes('%PATH%')) extraPaths.push(...raw.split(';'))
    } catch {}
    // Collect from powershell
    try {
      const raw = execSync('powershell.exe -NoProfile -Command "$env:PATH"', {
        encoding: 'utf-8', timeout: 5000,
      }).trim()
      if (raw) extraPaths.push(...raw.split(';'))
    } catch {}
    // Common locations
    extraPaths.push(
      path.join(home, 'AppData', 'Roaming', 'npm'),
      path.join(home, 'AppData', 'Local', 'Programs', 'claude-code'),
      path.join(home, '.volta', 'bin'),
      'C:\\Program Files\\nodejs',
    )
  } else {
    // macOS / Linux: read from user's login shell
    try {
      const shell = process.env.SHELL || '/bin/zsh'
      const raw = execSync(`${shell} -ilc 'echo $PATH'`, { encoding: 'utf-8', timeout: 8000 }).trim()
      if (raw) extraPaths.push(...raw.split(':'))
    } catch {}
    extraPaths.push(
      `${home}/.nvm/versions/node/current/bin`,
      `${home}/.npm-global/bin`,
      `${home}/.volta/bin`,
      `${home}/.local/bin`,
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
    )
  }

  // Merge + deduplicate
  const currentPaths = (env.PATH || '').split(pathSep)
  const allPaths = [...currentPaths, ...extraPaths]
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const p of allPaths) {
    const normalized = p.trim()
    const key = isWin ? normalized.toLowerCase() : normalized
    if (normalized && !seen.has(key)) {
      seen.add(key)
      deduped.push(normalized)
    }
  }
  env.PATH = deduped.join(pathSep)
  return env
}

// ---------------------------------------------------------------------------
// 2. Collect all candidate binary paths
// ---------------------------------------------------------------------------
function getCandidatePaths(): string[] {
  const home = os.homedir()
  const candidates: string[] = []

  if (isWin) {
    // Try `where` via cmd
    try {
      const raw = execSync('cmd.exe /c where claude', { encoding: 'utf-8', timeout: 5000 }).trim()
      for (const line of raw.split(/\r?\n/)) {
        if (line.trim()) candidates.push(line.trim())
      }
    } catch {}
    // Try powershell Get-Command
    try {
      const raw = execSync(
        'powershell.exe -NoProfile -Command "(Get-Command claude -ErrorAction SilentlyContinue).Source"',
        { encoding: 'utf-8', timeout: 5000 },
      ).trim()
      if (raw) candidates.push(raw)
    } catch {}
    // Common locations
    candidates.push(
      path.join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
      path.join(home, 'AppData', 'Roaming', 'npm', 'claude.ps1'),
      path.join(home, 'AppData', 'Roaming', 'npm', 'claude'),
      path.join(home, 'AppData', 'Roaming', 'npm', 'claude.exe'),
      path.join(home, '.volta', 'bin', 'claude.cmd'),
      path.join(home, '.volta', 'bin', 'claude.exe'),
      path.join(home, 'AppData', 'Local', 'Programs', 'claude-code', 'claude.exe'),
      'C:\\Program Files\\nodejs\\claude.cmd',
    )
  } else {
    // macOS / Linux: `which`
    try {
      const raw = execSync('which claude', { encoding: 'utf-8', env: mergedEnv, timeout: 5000 }).trim()
      if (raw) candidates.push(raw)
    } catch {}
    candidates.push(
      `${home}/.npm-global/bin/claude`,
      `${home}/.nvm/versions/node/current/bin/claude`,
      `${home}/.volta/bin/claude`,
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
    )
  }

  // Also try bare 'claude' as last resort (shell will resolve)
  candidates.push('claude')

  // Deduplicate
  const seen = new Set<string>()
  return candidates.filter(c => {
    const key = isWin ? c.toLowerCase() : c
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ---------------------------------------------------------------------------
// 3. Try executing a candidate with --version
// ---------------------------------------------------------------------------
function tryExec(bin: string, env: Record<string, string>): Promise<{ ok: boolean; version: string; shell: string | true }> {
  // Determine which shell to use for this binary
  const shells: Array<string | true> = []
  if (isWin) {
    if (bin.endsWith('.cmd')) shells.push('cmd.exe')
    else if (bin.endsWith('.ps1')) shells.push('powershell.exe')
    else shells.push('cmd.exe', 'powershell.exe', true)
  } else {
    shells.push(true)
  }

  return new Promise((resolve) => {
    let tried = 0
    const tryNext = () => {
      if (tried >= shells.length) {
        resolve({ ok: false, version: '', shell: true })
        return
      }
      const shell = shells[tried++]
      try {
        const proc = spawn(bin, ['--version'], { env, shell, timeout: 15000 } as any)
        let stdout = ''
        let done = false

        const finish = (ok: boolean) => {
          if (done) return
          done = true
          proc.kill()
          if (ok && stdout.trim()) {
            resolve({ ok: true, version: stdout.trim().slice(0, 100), shell })
          } else {
            tryNext()
          }
        }

        proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString('utf-8') })
        proc.on('close', (code) => finish(code === 0))
        proc.on('error', () => finish(false))
        setTimeout(() => finish(false), 15000)
      } catch {
        tryNext()
      }
    }
    tryNext()
  })
}

// ---------------------------------------------------------------------------
// 4. validateClaude — the main startup routine
// ---------------------------------------------------------------------------
async function validateClaude(): Promise<ValidateResult> {
  const sendStatus = (step: string, message: string) => {
    console.log(`[claude-chat] setup: ${step} — ${message}`)
    mainWindow?.webContents.send('setup:status', { step, message })
  }

  // Step 1: Build environment
  sendStatus('searching', '正在检测系统环境...')
  mergedEnv = buildMergedEnv()

  // Step 2: Collect candidates
  sendStatus('searching', '正在搜索 Claude Code...')
  const candidates = getCandidatePaths()
  console.log('[claude-chat] candidates:', candidates.filter(c => c !== 'claude' && (c === 'claude' || fs.existsSync(c))))

  // Step 3: Try each candidate
  sendStatus('validating', '正在验证 Claude Code...')
  for (const bin of candidates) {
    // Skip non-existent files (but allow bare 'claude' which relies on shell)
    if (bin !== 'claude' && !fs.existsSync(bin)) continue

    const result = await tryExec(bin, mergedEnv)
    if (result.ok) {
      claudeBin = bin
      claudeShell = result.shell
      const vr: ValidateResult = { ok: true, bin, version: result.version }
      validateResult = vr
      sendStatus('done', `就绪！${result.version}`)
      console.log(`[claude-chat] validated: ${bin} (${result.version}) shell=${result.shell}`)
      return vr
    }
  }

  // Step 4: All failed
  const error = 'Claude Code 未找到。请先安装 Claude Code 后重启应用。'
  const vr: ValidateResult = { ok: false, bin: '', version: '', error }
  validateResult = vr
  sendStatus('error', error)
  console.error('[claude-chat] validation failed: claude not found anywhere')
  return vr
}

// ---------------------------------------------------------------------------
// 5. Window
// ---------------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 500,
    minHeight: 400,
    ...(isWin
      ? {}
      : { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 16 } }),
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// ---------------------------------------------------------------------------
// 6. App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  createWindow()
  // Run validation after window is visible so user sees the setup screen
  await validateClaude()
})

function killActive() {
  if (!activeProcess) return
  try {
    if (isWin) {
      execSync(`taskkill /pid ${activeProcess.pid} /T /F`, { stdio: 'ignore', timeout: 3000 })
    } else {
      activeProcess.kill('SIGTERM')
    }
  } catch {}
  activeProcess = null
}

app.on('window-all-closed', () => {
  killActive()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', killActive)

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ---------------------------------------------------------------------------
// 7. IPC — Setup
// ---------------------------------------------------------------------------
ipcMain.handle('setup:get-result', () => validateResult)

ipcMain.handle('setup:retry', async () => {
  validateResult = null
  await validateClaude()
})

// ---------------------------------------------------------------------------
// 8. IPC — Chat
// ---------------------------------------------------------------------------
let activeProcess: ChildProcess | null = null

ipcMain.handle('chat:send', async (_event, prompt: string) => {
  if (!validateResult?.ok) {
    mainWindow?.webContents.send('chat:error', 'Claude Code 未就绪，请重启应用。')
    return
  }

  killActive()

  return new Promise<void>((resolve) => {
    const claude = spawn(claudeBin, ['-p', '--dangerously-skip-permissions', prompt], {
      env: mergedEnv,
      shell: claudeShell,
    })

    activeProcess = claude

    claude.stdout.on('data', (data: Buffer) => {
      const text = data.toString('utf-8')
      if (text) mainWindow?.webContents.send('chat:stream', text)
    })

    claude.stderr.on('data', (data: Buffer) => {
      const text = data.toString('utf-8').trim()
      if (text) mainWindow?.webContents.send('chat:error', text)
    })

    claude.on('close', (code) => {
      activeProcess = null
      mainWindow?.webContents.send('chat:done', { code })
      resolve()
    })

    claude.on('error', (err) => {
      activeProcess = null
      mainWindow?.webContents.send('chat:error', `Process error: ${err.message}`)
      resolve()
    })
  })
})

ipcMain.handle('chat:stop', () => {
  killActive()
})
