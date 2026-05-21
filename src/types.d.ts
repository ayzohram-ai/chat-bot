interface ClaudeBridge {
  send: (prompt: string) => Promise<void>
  stop: () => Promise<void>
  getFilePath: (file: File) => string
  onStream: (callback: (data: any) => void) => () => void
  onDone: (callback: (data: any) => void) => () => void
  onError: (callback: (error: string) => void) => () => void
}

interface SetupStatus {
  step: 'searching' | 'validating' | 'done' | 'error'
  message: string
}

interface SetupResult {
  ok: boolean
  bin: string
  version: string
  error?: string
}

interface SetupBridge {
  onStatus: (callback: (data: SetupStatus) => void) => () => void
  getResult: () => Promise<SetupResult | null>
  retry: () => Promise<void>
}

interface Window {
  claude: ClaudeBridge
  setup: SetupBridge
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isStreaming?: boolean
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: string
  updatedAt: string
}

interface AttachedFile {
  name: string
  path: string
}
