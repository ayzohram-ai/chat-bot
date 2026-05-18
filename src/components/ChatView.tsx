import React, { useRef, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import MessageBubble from './MessageBubble'

interface Props {
  messages: Message[]
}

export default function ChatView({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-violet-900/30">
            <Sparkles size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Claude Chat</h1>
          <p className="text-gray-500 text-sm max-w-sm">
            Ask anything. Powered by Claude Code.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
