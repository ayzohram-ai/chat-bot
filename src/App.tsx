import React from 'react'
import { Trash2 } from 'lucide-react'
import ChatView from './components/ChatView'
import InputBar from './components/InputBar'
import { useChat } from './hooks/useChat'

export default function App() {
  const { messages, isLoading, sendMessage, stopGeneration, clearMessages } = useChat()

  return (
    <div className="h-screen flex flex-col bg-chat-bg text-white">
      {/* Titlebar */}
      <div className="titlebar-drag flex items-center justify-between px-20 py-3 border-b border-chat-border bg-chat-bg/80 backdrop-blur-md">
        <span className="text-sm font-medium text-gray-400">Claude Chat</span>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="titlebar-no-drag p-1.5 rounded-md hover:bg-chat-hover text-gray-600 hover:text-gray-400 transition-colors"
            title="Clear chat"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Chat area */}
      <ChatView messages={messages} />

      {/* Input */}
      <InputBar onSend={sendMessage} onStop={stopGeneration} isLoading={isLoading} />
    </div>
  )
}
