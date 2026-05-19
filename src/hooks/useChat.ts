import { useState, useEffect, useCallback, useRef } from 'react'

function buildPromptWithContext(messages: Message[], newMessage: string): string {
  const history = messages.filter(m => !m.isStreaming && m.content)
  if (history.length === 0) return newMessage

  const recent = history.slice(-20)
  let transcript = 'Previous conversation:\n'
  for (const msg of recent) {
    transcript += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`
  }
  transcript += `\nCurrent message from user: ${newMessage}`
  return transcript
}

export function useChat(
  conversationId: string | null,
  initialMessages: Message[] = [],
  onMessagesChange?: (messages: Message[]) => void,
) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const streamTextRef = useRef('')
  const onMessagesChangeRef = useRef(onMessagesChange)
  const prevConvIdRef = useRef(conversationId)
  onMessagesChangeRef.current = onMessagesChange

  // Only reset when conversation ID actually changes (not on first create)
  useEffect(() => {
    if (conversationId !== prevConvIdRef.current) {
      const wasNull = prevConvIdRef.current === null
      prevConvIdRef.current = conversationId

      // If switching from null to a new ID, it's a new conversation being created
      // Don't reset if we're currently loading (means we just sent the first message)
      if (wasNull && isLoading) return

      // Switching between existing conversations
      setMessages(initialMessages)
      setIsLoading(false)
      streamTextRef.current = ''
      window.claude.stop()
    }
  }, [conversationId, initialMessages, isLoading])

  // Persist messages on change
  useEffect(() => {
    if (!messages.some(m => m.isStreaming)) {
      onMessagesChangeRef.current?.(messages)
    }
  }, [messages])

  useEffect(() => {
    const unsubStream = window.claude.onStream((text: string) => {
      streamTextRef.current += text
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last && last.role === 'assistant' && last.isStreaming) {
          updated[updated.length - 1] = { ...last, content: streamTextRef.current }
        }
        return updated
      })
    })

    const unsubDone = window.claude.onDone(() => {
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last && last.role === 'assistant' && last.isStreaming) {
          updated[updated.length - 1] = { ...last, isStreaming: false }
        }
        return updated
      })
      setIsLoading(false)
      streamTextRef.current = ''
    })

    const unsubError = window.claude.onError((error: string) => {
      console.error('Claude error:', error)
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last && last.role === 'assistant' && last.isStreaming) {
          updated[updated.length - 1] = {
            ...last,
            content: `Error: ${error}`,
            isStreaming: false,
          }
        }
        return updated
      })
      setIsLoading(false)
      streamTextRef.current = ''
    })

    return () => {
      unsubStream()
      unsubDone()
      unsubError()
    }
  }, [])

  const sendMessage = useCallback(async (content: string, promptOverride?: string) => {
    if ((!content.trim() && !promptOverride) || isLoading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    }

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    }

    streamTextRef.current = ''
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsLoading(true)

    try {
      const textForClaude = promptOverride || content.trim()
      const prompt = buildPromptWithContext(messages, textForClaude)
      await window.claude.send(prompt)
    } catch (err) {
      console.error('Failed to send:', err)
      setIsLoading(false)
    }
  }, [isLoading, messages])

  const stopGeneration = useCallback(() => {
    window.claude.stop()
    setMessages((prev) => {
      const updated = [...prev]
      const last = updated[updated.length - 1]
      if (last && last.role === 'assistant' && last.isStreaming) {
        updated[updated.length - 1] = { ...last, isStreaming: false }
      }
      return updated
    })
    setIsLoading(false)
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return { messages, isLoading, sendMessage, stopGeneration, clearMessages }
}
