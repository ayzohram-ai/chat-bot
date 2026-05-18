import React from 'react'
import { User, Sparkles } from 'lucide-react'
import MarkdownRenderer from './MarkdownRenderer'

interface Props {
  message: Message
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-5`}>
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
        <div className={`rounded-2xl px-4 py-3 ${
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
        </div>
      </div>
    </div>
  )
}
