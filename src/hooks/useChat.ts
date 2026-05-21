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
  const isLoadingRef = useRef(false)
  const onMessagesChangeRef = useRef(onMessagesChange)
  const prevConvIdRef = useRef(conversationId)
  const messagesRef = useRef(messages)

  onMessagesChangeRef.current = onMessagesChange
  messagesRef.current = messages
  isLoadingRef.current = isLoading

  // ------------------------------------------------------------------
  // Handle conversation switching
  // ------------------------------------------------------------------
  useEffect(() => {
    if (conversationId === prevConvIdRef.current) return

    const wasNull = prevConvIdRef.current === null
    prevConvIdRef.current = conversationId

    // Creating a new conversation while a message is being sent — don't reset
    if (wasNull && isLoadingRef.current) return

    // Switching to a different conversation — stop current generation
    window.claude.stop()
    setMessages(initialMessages)
    setIsLoading(false)
    streamTextRef.current = ''
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync initialMessages when switching conversations
  useEffect(() => {
    if (conversationId !== null && !isLoadingRef.current && initialMessages.length > 0) {
      setMessages(initialMessages)
    }
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Persist messages when streaming is done
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!messages.some(m => m.isStreaming) && messages.length > 0) {
      onMessagesChangeRef.current?.(messages)
    }
  }, [messages])

  // ------------------------------------------------------------------
  // IPC event listeners — register once, use refs to access latest state
  // ------------------------------------------------------------------
  useEffect(() => {
    const unsubStream = window.claude.onStream((text: string) => {
      streamTextRef.current += text
      const content = streamTextRef.current
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && last.isStreaming) {
          const updated = prev.slice(0, -1)
          updated.push({ ...last, content })
          return updated
        }
        return prev
      })
    })

    const unsubDone = window.claude.onDone(() => {
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && last.isStreaming) {
          const updated = prev.slice(0, -1)
          updated.push({ ...last, isStreaming: false })
          return updated
        }
        return prev
      })
      setIsLoading(false)
      streamTextRef.current = ''
    })

    const unsubError = window.claude.onError((error: string) => {
      console.error('[claude-chat] error:', error)
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && last.isStreaming) {
          const updated = prev.slice(0, -1)
          updated.push({ ...last, content: `Error: ${error}`, isStreaming: false })
          return updated
        }
        return prev
      })
      setIsLoading(false)
      streamTextRef.current = ''
    })

    return () => {
      unsubStream()
      unsubDone()
      unsubError()
    }
  }, []) // Register once — all state access uses setMessages(prev => ...) or refs

  // ------------------------------------------------------------------
  // Send
  // ------------------------------------------------------------------
  const sendMessage = useCallback(async (content: string, promptOverride?: string) => {
    if (isLoadingRef.current) return
    if (!content.trim() && !promptOverride) return

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
      const prompt = buildPromptWithContext(messagesRef.current, textForClaude)
      await window.claude.send(prompt)
    } catch (err) {
      console.error('[claude-chat] send failed:', err)
      setIsLoading(false)
    }
  }, []) // No deps — uses refs for latest state

  const stopGeneration = useCallback(() => {
    window.claude.stop()
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (last?.role === 'assistant' && last.isStreaming) {
        const updated = prev.slice(0, -1)
        updated.push({ ...last, isStreaming: false })
        return updated
      }
      return prev
    })
    setIsLoading(false)
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return { messages, isLoading, sendMessage, stopGeneration, clearMessages }
}
