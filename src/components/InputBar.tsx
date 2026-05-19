import React, { useState, useRef, useEffect, DragEvent } from 'react'
import { Send, Square, FlaskConical, X, Paperclip } from 'lucide-react'

interface Props {
  onSend: (content: string) => void
  onStop: () => void
  onDistill: () => void
  isLoading: boolean
  hasMessages: boolean
  attachedFiles: AttachedFile[]
  onFilesAttach: (files: AttachedFile[]) => void
  onFileRemove: (index: number) => void
}

export default function InputBar({ onSend, onStop, onDistill, isLoading, hasMessages, attachedFiles, onFilesAttach, onFileRemove }: Props) {
  const [input, setInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dragCountRef = useRef(0)

  useEffect(() => {
    if (!isLoading) textareaRef.current?.focus()
  }, [isLoading])

  const handleSubmit = () => {
    if ((input.trim() || attachedFiles.length > 0) && !isLoading) {
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

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    dragCountRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    dragCountRef.current--
    if (dragCountRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    dragCountRef.current = 0
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const newFiles: AttachedFile[] = files.map(f => ({
      name: f.name,
      path: window.claude.getFilePath(f),
    }))
    onFilesAttach(newFiles)
  }

  return (
    <div
      className="p-4 border-t border-chat-border bg-chat-bg"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="max-w-3xl mx-auto">
        {/* Attached files */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachedFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-900/30 border border-violet-700/40 text-sm text-violet-300">
                <Paperclip size={12} />
                <span className="max-w-[200px] truncate">{file.name}</span>
                <button
                  onClick={() => onFileRemove(i)}
                  className="p-0.5 rounded hover:bg-violet-700/40 text-violet-400 hover:text-violet-200 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className={`flex items-end gap-3 rounded-2xl px-4 py-3 transition-all ${
          isDragging
            ? 'bg-violet-900/20 border-2 border-dashed border-violet-500/60'
            : 'bg-chat-surface border border-chat-border focus-within:border-violet-600/50'
        }`}>
          {isDragging ? (
            <div className="flex-1 text-center py-2 text-violet-400 text-sm">
              放开以添加文件
            </div>
          ) : (
            <>
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
                placeholder={attachedFiles.length > 0 ? "添加说明（可选）..." : "Message Claude..."}
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
                  disabled={!input.trim() && attachedFiles.length === 0}
                  className="titlebar-no-drag flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  <Send size={14} className="text-white" />
                </button>
              )}
            </>
          )}
        </div>
        <p className="text-center text-[10px] text-gray-700 mt-2">
          Powered by Claude Code · Shift+Enter for new line · 拖入文件即可附加
        </p>
      </div>
    </div>
  )
}
