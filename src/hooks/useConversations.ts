import { useState, useEffect, useCallback } from 'react'
import { loadConversations, saveConversations } from '../lib/storage'

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations())
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    saveConversations(conversations)
  }, [conversations])

  const activeConversation = conversations.find(c => c.id === activeId) || null

  const createConversation = useCallback((firstMessage: string): string => {
    const id = crypto.randomUUID()
    const title = firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '...' : '')
    const conv: Conversation = {
      id,
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setConversations(prev => [conv, ...prev])
    setActiveId(id)
    return id
  }, [])

  const updateMessages = useCallback((id: string, messages: Message[]) => {
    setConversations(prev => prev.map(c =>
      c.id === id ? { ...c, messages, updatedAt: new Date().toISOString() } : c
    ))
  }, [])

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id))
    setActiveId(prev => prev === id ? null : prev)
  }, [])

  const newChat = useCallback(() => setActiveId(null), [])
  const switchConversation = useCallback((id: string) => setActiveId(id), [])

  return {
    conversations,
    activeConversation,
    activeId,
    createConversation,
    updateMessages,
    deleteConversation,
    newChat,
    switchConversation,
  }
}
