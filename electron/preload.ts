import { contextBridge, ipcRenderer, webUtils } from 'electron'

// Setup bridge — startup detection progress
contextBridge.exposeInMainWorld('setup', {
  onStatus: (callback: (data: { step: string; message: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('setup:status', listener)
    return () => ipcRenderer.removeListener('setup:status', listener)
  },
  getResult: () => ipcRenderer.invoke('setup:get-result'),
  retry: () => ipcRenderer.invoke('setup:retry'),
})

// Claude bridge — chat messaging
contextBridge.exposeInMainWorld('claude', {
  send: (prompt: string) => ipcRenderer.invoke('chat:send', prompt),
  stop: () => ipcRenderer.invoke('chat:stop'),
  getFilePath: (file: File) => webUtils.getPathForFile(file),
  onStream: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('chat:stream', listener)
    return () => ipcRenderer.removeListener('chat:stream', listener)
  },
  onDone: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('chat:done', listener)
    return () => ipcRenderer.removeListener('chat:done', listener)
  },
  onError: (callback: (error: string) => void) => {
    const listener = (_event: any, error: string) => callback(error)
    ipcRenderer.on('chat:error', listener)
    return () => ipcRenderer.removeListener('chat:error', listener)
  },
})
