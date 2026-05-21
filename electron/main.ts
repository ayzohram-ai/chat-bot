import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn, ChildProcess, execSync } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'

const isWin = process.platform === 'win32'
const pathSep = isWin ? ';' : ':'

let mainWindow: BrowserWindow | null = null

// ---------------------------------------------------------------------------
// 1. Build a merged PATH that covers ALL shells the user might have.
//    We don't pick cmd vs powershell — we merge both, plus common locations.
// ---------------------------------------------------------------------------
function buildMergedEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>
  const home = os.homedir()
  const extraPaths: string[] = []

  if (isWin) {
    // Collect PATH from cmd
    try {
      const raw = execSync('cmd.exe /c "echo %PATH%"', { encoding: 'utf-8', timeout: 5000 }).trim()
      if (raw && !raw.includes('%PATH%')) extraPaths.push(...raw.split(';'))
    } catch {}

    // Collect PATH from powershell
    try {
      const raw = execSync('powershell.exe -NoProfile -Command "$env:PATH"', {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim()
      if (raw) extraPaths.push(...raw.split(';'))
    } catch {}

    // Common install locations
    extraPaths.push(
      path.join(home, 'AppData', 'Roaming', 'npm'),
      path.join(home, '.volta', 'bin'),
      'C:\\Program Files\\nodejs',
    )
  } else {
    // macOS / Linux: read from user's login shell
    try {
      const shell = process.env.SHELL || '/bin/zsh'
      const raw = execSync(`${shell} -ilc 'echo $PATH'`, {
        encoding: 'utf-8',
        timeout: 8000,
      }).trim()
      if (raw) extraPaths.push(...raw.split(':'))
    } catch {}

    // Common install locations
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

  // Merge: current PATH + all discovered paths, deduplicated
  const currentPaths = (env.PATH || '').split(pathSep)
  const allPaths = [...currentPaths, ...extraPaths]
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const p of allPaths) {
    const normalized = p.trim()
    if (normalized && !seen.has(normalized.toLowerCase())) {
      seen.add(normalized.toLowerCase())
      deduped.push(normalized)
    }
  }
  env.PATH = deduped.join(pathSep)

  return env
}

// ---------------------------------------------------------------------------
// 2. Find claude — try every method, return absolute path or bare name
// ---------------------------------------------------------------------------
function findClaudeBinary(env: Record<string, string>): { bin: string; shell: string | true } {
  const home = os.homedir()

  if (isWin) {
    // Try `where` via cmd
    try {
      const result = execSync('cmd.exe /c where claude', { encoding: 'utf-8', env, timeout: 5000 }).trim()
      const first = result.split(/\r?\n/)[0].trim()
      if (first && fs.existsSync(first)) {
        return { bin: first, shell: first.endsWith('.cmd') ? 'cmd.exe' : true }
      }
    } catch {}

    // Try `where` via powershell
    try {
      const result = execSync(
        'powershell.exe -NoProfile -Command "(Get-Command claude -ErrorAction SilentlyContinue).Source"',
        { encoding: 'utf-8', env, timeout: 5000 },
      ).trim()
      if (result && fs.existsSync(result)) {
        return { bin: result, shell: result.endsWith('.cmd') ? 'cmd.exe' : 'powershell.exe' }
      }
    } catch {}

    // Brute-force common locations
    const candidates = [
      path.join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
      path.join(home, 'AppData', 'Roaming', 'npm', 'claude.ps1'),
      path.join(home, 'AppData', 'Roaming', 'npm', 'claude'),
      path.join(home, '.volta', 'bin', 'claude.cmd'),
      path.join(home, '.volta', 'bin', 'claude.exe'),
      'C:\\Program Files\\nodejs\\claude.cmd',
    ]
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return { bin: p, shell: p.endsWith('.cmd') ? 'cmd.exe' : true }
      }
    }
  } else {
    // macOS / Linux: `which`
    try {
      const result = execSync('which claude', { encoding: 'utf-8', env, timeout: 5000 }).trim()
      if (result && fs.existsSync(result)) return { bin: result, shell: true }
    } catch {}

    // Brute-force
    const candidates = [
      `${home}/.npm-global/bin/claude`,
      `${home}/.nvm/versions/node/current/bin/claude`,
      `${home}/.volta/bin/claude`,
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
    ]
    for (const p of candidates) {
      if (fs.existsSync(p)) return { bin: p, shell: true }
    }
  }

  // Last resort — bare name, let shell resolve at runtime
  return { bin: 'claude', shell: true }
}

const mergedEnv = buildMergedEnv()
const { bin: claudeBin, shell: claudeShell } = findClaudeBinary(mergedEnv)
console.log('[claude-chat] platform:', process.platform)
console.log('[claude-chat] PATH:', mergedEnv.PATH)
console.log('[claude-chat] resolved claude binary:', claudeBin)
console.log('[claude-chat] shell:', claudeShell)

// ---------------------------------------------------------------------------
// 3. Window
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

app.whenReady().then(createWindow)

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
// 4. Claude CLI integration
// ---------------------------------------------------------------------------
let activeProcess: ChildProcess | null = null

ipcMain.handle('chat:send', async (_event, prompt: string) => {
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
