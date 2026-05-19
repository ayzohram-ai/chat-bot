import React, { useState, useRef, useEffect } from 'react'
import { Send, Square, FlaskConical } from 'lucide-react'

interface Props {
  onSend: (content: string) => void
  onStop: () => void
  onDistill: () => void
  isLoading: boolean
  hasMessages: boolean
}

export default function InputBar({ onSend, onStop, onDistill, isLoading, hasMessages }: Props) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isLoading) textareaRef.current?.focus()
  }, [isLoading])

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSend(input)
      setInput('')
      if (textareaRef.current) textareaRef.current.style.height = '24px'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = '24px'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  return (
    <div className="p-4 border-t border-chat-border bg-chat-bg">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-3 bg-chat-surface border border-chat-border rounded-2xl px-4 py-3 focus-within:border-violet-600/50 transition-colors">
          {hasMessages && !isLoading && (
            <button
              onClick={onDistill}
              className="titlebar-no-drag flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-600/20 text-amber-500/60 hover:text-amber-400 transition-colors"
              title="蒸馏 · 提取本次对话关键信息"
            >
              <FlaskConical size={15} />
            </button>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Message Claude..."
            rows={1}
            className="titlebar-no-drag flex-1 bg-transparent text-gray-200 placeholder-gray-600 resize-none outline-none text-[14.5px] leading-relaxed"
            style={{ height: '24px', maxHeight: '160px' }}
          />
          {isLoading ? (
            <button
              onClick={onStop}
              className="titlebar-no-drag flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-500 transition-colors"
            >
              <Square size={14} className="text-white" fill="white" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="titlebar-no-drag flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              <Send size={14} className="text-white" />
            </button>
          )}
        </div>
        <p className="text-center text-[10px] text-gray-700 mt-2">
          Powered by Claude Code · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
