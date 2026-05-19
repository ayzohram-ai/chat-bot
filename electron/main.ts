import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

let mainWindow: BrowserWindow | null = null

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
  if (process.platform !== 'darwin') app.quit()
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
    const claude = spawn('claude', ['-p', '--dangerously-skip-permissions', prompt], {
      env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` },
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
