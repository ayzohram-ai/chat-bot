const STORAGE_KEY = 'claude-chat-conversations'

function isValidConversation(obj: any): obj is Conversation {
  return obj && typeof obj.id === 'string' && typeof obj.title === 'string' && Array.isArray(obj.messages)
}

export function loadConversations(): Conversation[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    const parsed = JSON.parse(data)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidConversation)
  } catch {
    return []
  }
}

export function saveConversations(conversations: Conversation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
}
