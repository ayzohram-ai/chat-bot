import { useState, useEffect, useCallback, useRef } from 'react'

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const streamTextRef = useRef('')

  useEffect(() => {
    const unsubStream = window.claude.onStream((data: any) => {
      // Handle stream-json format from Claude CLI
      if (data.type === 'assistant' && data.message?.content) {
        for (const block of data.message.content) {
          if (block.type === 'text') {
            streamTextRef.current = block.text
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last && last.role === 'assistant' && last.isStreaming) {
                updated[updated.length - 1] = { ...last, content: streamTextRef.current }
              }
              return updated
            })
          }
        }
      }
      // Handle content_block_delta for streaming
      if (data.type === 'content_block_delta' && data.delta?.text) {
        streamTextRef.current += data.delta.text
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === 'assistant' && last.isStreaming) {
            updated[updated.length - 1] = { ...last, content: streamTextRef.current }
          }
          return updated
        })
      }
      // Handle result message (final)
      if (data.type === 'result' && data.result) {
        const text = typeof data.result === 'string' ? data.result : data.result
        if (text) {
          streamTextRef.current = text
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last && last.role === 'assistant' && last.isStreaming) {
              updated[updated.length - 1] = { ...last, content: text, isStreaming: false }
            }
            return updated
          })
        }
      }
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
    })

    return () => {
      unsubStream()
      unsubDone()
      unsubError()
    }
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }

    streamTextRef.current = ''
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsLoading(true)

    try {
      await window.claude.send(content.trim())
    } catch (err) {
      console.error('Failed to send:', err)
      setIsLoading(false)
    }
  }, [isLoading])

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
