interface ClaudeBridge {
  send: (prompt: string) => Promise<void>
  stop: () => Promise<void>
  onStream: (callback: (data: any) => void) => () => void
  onDone: (callback: (data: any) => void) => () => void
  onError: (callback: (error: string) => void) => () => void
}

interface Window {
  claude: ClaudeBridge
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
}
