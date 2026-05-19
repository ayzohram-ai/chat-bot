import React, { useState, useCallback } from 'react'
import { Menu, Trash2 } from 'lucide-react'
import ChatView from './components/ChatView'
import InputBar from './components/InputBar'
import Sidebar from './components/Sidebar'
import { useChat } from './hooks/useChat'
import { useConversations } from './hooks/useConversations'

export default function App() {
  const {
    conversations, activeConversation, activeId,
    createConversation, updateMessages, deleteConversation,
    newChat, switchConversation,
  } = useConversations()

  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleMessagesChange = useCallback((msgs: Message[]) => {
    if (activeId && msgs.length > 0) {
      updateMessages(activeId, msgs)
    }
  }, [activeId, updateMessages])

  const { messages, isLoading, sendMessage, stopGeneration, clearMessages } = useChat(
    activeConversation?.messages || [],
    handleMessagesChange,
  )

  const handleSend = useCallback((content: string) => {
    if (!activeId) {
      createConversation(content)
    }
    sendMessage(content)
  }, [activeId, createConversation, sendMessage])

  const handleDistill = useCallback(() => {
    if (messages.length === 0 || isLoading) return
    const distillPrompt = `请对以上对话内容进行"蒸馏"，提取本次对话中最重要的、值得跨会话记住的关键信息。

请按以下分类整理输出：

## 🔑 API 配置
（如有新的 API endpoint、key、模型配置等）

## ⚙️ 用户偏好
（如有工具偏好、输出格式偏好、工作习惯等）

## 📁 项目信息
（如有项目路径、技术栈、架构决策等）

## 📝 代码片段
（如有值得保存的常用命令或代码模板，精简展示）

## 📇 联系信息
（如有公司名称、地址、联系方式等）

规则：
- 只提取可跨会话复用的关键信息，忽略临时调试过程
- 每条信息用一行简洁描述
- 如果某个分类没有内容，跳过该分类
- 用中文输出`
    handleSend(distillPrompt)
  }, [messages, isLoading, handleSend])

  const handleNewChat = useCallback(() => {
    newChat()
    clearMessages()
    setSidebarOpen(false)
  }, [newChat, clearMessages])

  const handleSelect = useCallback((id: string) => {
    if (isLoading) {
      stopGeneration()
    }
    switchConversation(id)
    setSidebarOpen(false)
  }, [isLoading, stopGeneration, switchConversation])

  return (
    <div className="h-screen flex flex-col bg-chat-bg text-white">
      {/* Titlebar */}
      <div className="titlebar-drag flex items-center justify-between px-20 py-3 border-b border-chat-border bg-chat-bg/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="titlebar-no-drag p-1.5 rounded-md hover:bg-chat-hover text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Menu size={16} />
          </button>
          <span className="text-sm font-medium text-gray-400">Claude Chat</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleNewChat}
            className="titlebar-no-drag p-1.5 rounded-md hover:bg-chat-hover text-gray-600 hover:text-gray-400 transition-colors"
            title="New chat"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelect}
        onDelete={deleteConversation}
        onNewChat={handleNewChat}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Chat area */}
      <ChatView messages={messages} />

      {/* Input */}
      <InputBar
        onSend={handleSend}
        onStop={stopGeneration}
        onDistill={handleDistill}
        isLoading={isLoading}
        hasMessages={messages.length > 0}
      />
    </div>
  )
}
