import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn, ChildProcess, execSync } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'

let mainWindow: BrowserWindow | null = null

// Resolve the user's full login-shell environment.
// Electron (especially packaged .app) does NOT inherit the user's PATH.
function getShellEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>
  try {
    const shell = process.env.SHELL || '/bin/zsh'
    // -ilc: interactive login shell → loads .zshrc/.bashrc/.profile
    const raw = execSync(`${shell} -ilc 'env'`, {
      encoding: 'utf-8',
      timeout: 8000,
    })
    for (const line of raw.split('\n')) {
      const idx = line.indexOf('=')
      if (idx > 0) {
        env[line.slice(0, idx)] = line.slice(idx + 1)
      }
    }
  } catch {
    // Fallback: manually patch PATH with common locations
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
    env.PATH = [...extra, env.PATH || ''].join(':')
  }
  return env
}

// Find the absolute path to the `claude` binary.
// On Windows, `claude` is actually `claude.cmd` — spawn without shell won't find it.
function findClaudeBinary(env: Record<string, string>): string {
  const isWin = process.platform === 'win32'

  // 1. Try `which` / `where` using the resolved env
  try {
    const cmd = isWin ? 'where claude' : 'which claude'
    const result = execSync(cmd, { encoding: 'utf-8', env, timeout: 5000 }).trim()
    const first = result.split('\n')[0].trim()
    if (first && fs.existsSync(first)) return first
  } catch {}

  // 2. Brute-force scan common locations
  const home = os.homedir()
  const candidates = isWin
    ? [
        `${home}\\AppData\\Roaming\\npm\\claude.cmd`,
        `${home}\\.volta\\bin\\claude.cmd`,
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

  // 3. Last resort — hope it's on PATH at runtime
  return 'claude'
}

const shellEnv = getShellEnv()
const claudeBin = findClaudeBinary(shellEnv)
console.log('[claude-chat] resolved claude binary:', claudeBin)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 500,
    minHeight: 400,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
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

app.on('window-all-closed', () => {
  if (activeProcess) {
    activeProcess.kill()
    activeProcess = null
  }
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (activeProcess) {
    activeProcess.kill()
    activeProcess = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Claude CLI integration
let activeProcess: ChildProcess | null = null

ipcMain.handle('chat:send', async (event, prompt: string) => {
  // Kill any existing process
  if (activeProcess) {
    activeProcess.kill()
    activeProcess = null
  }

  return new Promise<void>((resolve, reject) => {
    const claude = spawn(claudeBin, ['-p', '--dangerously-skip-permissions', prompt], {
      env: shellEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    activeProcess = claude

    claude.stdout.on('data', (data: Buffer) => {
      mainWindow?.webContents.send('chat:stream', data.toString())
    })

    claude.stderr.on('data', (data: Buffer) => {
      const text = data.toString()
      if (text.trim()) {
        mainWindow?.webContents.send('chat:error', text)
      }
    })

    claude.on('close', (code) => {
      activeProcess = null
      mainWindow?.webContents.send('chat:done', { code })
      resolve()
    })

    claude.on('error', (err) => {
      activeProcess = null
      mainWindow?.webContents.send('chat:error', err.message)
      reject(err)
    })
  })
})

ipcMain.handle('chat:stop', () => {
  if (activeProcess) {
    activeProcess.kill()
    activeProcess = null
  }
})
