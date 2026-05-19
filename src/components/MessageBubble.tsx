import React, { useState } from 'react'
import { User, Sparkles, Copy, Check } from 'lucide-react'
import MarkdownRenderer from './MarkdownRenderer'

interface Props {
  message: Message
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const showCopy = message.content && !message.isStreaming

  return (
    <div className={`group flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-5`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser
          ? 'bg-chat-user'
          : 'bg-gradient-to-br from-violet-600 to-purple-700'
      }`}>
        {isUser ? <User size={15} className="text-white" /> : <Sparkles size={15} className="text-white" />}
      </div>

      {/* Content */}
      <div className={`max-w-[80%] ${isUser ? 'text-right' : 'text-left'}`}>
        <span className="text-[11px] text-gray-600 mb-1 block">
          {isUser ? 'You' : 'Claude'}
        </span>
        <div className={`relative rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-chat-user text-white rounded-tr-sm'
            : 'bg-chat-surface text-gray-200 rounded-tl-sm border border-chat-border'
        }`}>
          {isUser ? (
            <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div>
              {message.content ? (
                <MarkdownRenderer content={message.content} />
              ) : message.isStreaming ? (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce [animation-delay:0ms]"></span>
                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce [animation-delay:150ms]"></span>
                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce [animation-delay:300ms]"></span>
                  </div>
                  <span className="text-xs text-gray-500">Thinking...</span>
                </div>
              ) : null}
              {message.isStreaming && message.content && (
                <span className="typing-cursor"></span>
              )}
            </div>
          )}

          {/* Copy button */}
          {showCopy && (
            <button
              onClick={handleCopy}
              className={`absolute -bottom-3 ${isUser ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 p-1 rounded-md bg-chat-surface border border-chat-border hover:border-gray-600 transition-all`}
              title="Copy"
            >
              {copied ? (
                <Check size={12} className="text-green-400" />
              ) : (
                <Copy size={12} className="text-gray-500" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
