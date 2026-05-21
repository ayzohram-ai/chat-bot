import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn, ChildProcess, execSync } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'

const isWin = process.platform === 'win32'
const pathSep = isWin ? ';' : ':'

let mainWindow: BrowserWindow | null = null

// ---------------------------------------------------------------------------
// 1. Resolve the user's full login-shell environment
//    Electron (especially packaged .app / .exe) does NOT inherit the user's
//    shell PATH, nvm, volta, etc.
// ---------------------------------------------------------------------------
function getShellEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>

  if (isWin) {
    // Windows: `cmd /c set` dumps all env vars
    try {
      const raw = execSync('cmd /c set', { encoding: 'utf-8', timeout: 8000 })
      for (const line of raw.split('\r\n')) {
        const idx = line.indexOf('=')
        if (idx > 0) env[line.slice(0, idx)] = line.slice(idx + 1)
      }
    } catch {
      const home = os.homedir()
      const extra = [
        path.join(home, 'AppData', 'Roaming', 'npm'),
        path.join(home, '.volta', 'bin'),
        'C:\\Program Files\\nodejs',
      ]
      env.PATH = [...extra, env.PATH || ''].join(pathSep)
    }
  } else {
    // macOS / Linux: ask the user's default shell for its env
    try {
      const shell = process.env.SHELL || '/bin/zsh'
      const raw = execSync(`${shell} -ilc 'env'`, { encoding: 'utf-8', timeout: 8000 })
      for (const line of raw.split('\n')) {
        const idx = line.indexOf('=')
        if (idx > 0) env[line.slice(0, idx)] = line.slice(idx + 1)
      }
    } catch {
      const home = os.homedir()
      const extra = [
        `${home}/.nvm/versions/node/current/bin`,
        `${home}/.npm-global/bin`,
        `${home}/.volta/bin`,
        `${home}/.local/bin`,
        '/opt/homebrew/bin',
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
      ]
      env.PATH = [...extra, env.PATH || ''].join(pathSep)
    }
  }

  return env
}

// ---------------------------------------------------------------------------
// 2. Find the absolute path to the `claude` binary
//    On Windows npm installs `claude.cmd`; spawn without shell won't find it.
// ---------------------------------------------------------------------------
function findClaudeBinary(env: Record<string, string>): string {
  // 1. Try `which` / `where` with our resolved env
  try {
    const cmd = isWin ? 'where claude' : 'which claude'
    const result = execSync(cmd, { encoding: 'utf-8', env, timeout: 5000 }).trim()
    const first = result.split('\n')[0].trim()
    if (first && fs.existsSync(first)) return first
  } catch {}

  // 2. On Windows, also try via cmd.exe explicitly (different PATH than powershell)
  if (isWin) {
    try {
      const result = execSync('cmd.exe /c where claude', {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim()
      const first = result.split('\r\n')[0].trim()
      if (first && fs.existsSync(first)) return first
    } catch {}
  }

  // 3. Brute-force common install locations
  const home = os.homedir()
  const candidates = isWin
    ? [
        path.join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
        path.join(home, 'AppData', 'Roaming', 'npm', 'claude'),
        path.join(home, '.volta', 'bin', 'claude.cmd'),
        'C:\\Program Files\\nodejs\\claude.cmd',
      ]
    : [
        `${home}/.npm-global/bin/claude`,
        `${home}/.nvm/versions/node/current/bin/claude`,
        `${home}/.volta/bin/claude`,
        '/opt/homebrew/bin/claude',
        '/usr/local/bin/claude',
      ]

  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }

  // 4. Last resort — just 'claude', let the shell figure it out
  return 'claude'
}

const shellEnv = getShellEnv()
const claudeBin = findClaudeBinary(shellEnv)
console.log('[claude-chat] platform:', process.platform)
console.log('[claude-chat] resolved claude binary:', claudeBin)

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
      // Windows: taskkill /T kills the process tree
      execSync(`taskkill /pid ${activeProcess.pid} /T /F`, { stdio: 'ignore', timeout: 3000 })
    } else {
      activeProcess.kill('SIGTERM')
    }
  } catch {}
  activeProcess = null
}

app.on('window-all-closed', () => {
  killActive()
  if (!isWin && process.platform !== 'darwin') app.quit()
  if (isWin) app.quit()
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
    // Always spawn through a shell so it can resolve PATH, .cmd, etc.
    // On Windows: explicitly use cmd.exe (not powershell) since claude
    // may only be on cmd's PATH.
    const claude = spawn(claudeBin, ['-p', '--dangerously-skip-permissions', prompt], {
      env: shellEnv,
      shell: isWin ? process.env.ComSpec || 'cmd.exe' : true,
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
