import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('claude', {
  send: (prompt: string) => ipcRenderer.invoke('chat:send', prompt),
  stop: () => ipcRenderer.invoke('chat:stop'),
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
