import React from 'react'
import { Plus, Trash2, X, MessageSquare } from 'lucide-react'

interface Props {
  isOpen: boolean
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNewChat: () => void
  onClose: () => void
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString()
}

function groupByDate(conversations: Conversation[]): { label: string; items: Conversation[] }[] {
  const groups: Record<string, Conversation[]> = {}
  for (const conv of conversations) {
    const label = formatDate(conv.updatedAt)
    if (!groups[label]) groups[label] = []
    groups[label].push(conv)
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
}

export default function Sidebar({ isOpen, conversations, activeId, onSelect, onDelete, onNewChat, onClose }: Props) {
  const groups = groupByDate(conversations)

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      )}

      <div className={`fixed top-0 left-0 h-full w-[260px] bg-chat-surface border-r border-chat-border z-40 flex flex-col transition-transform duration-200 ease-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-chat-border">
          <span className="text-sm font-medium text-gray-300">History</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onNewChat(); onClose() }}
              className="p-1.5 rounded-md hover:bg-chat-hover text-gray-500 hover:text-gray-300 transition-colors"
              title="New chat"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-chat-hover text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-600 text-sm">
              No conversations yet
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <div className="px-4 py-1.5 text-[10px] text-gray-600 uppercase tracking-wider">
                  {group.label}
                </div>
                {group.items.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group/item flex items-center gap-2 px-3 py-2 mx-2 rounded-lg cursor-pointer transition-colors ${
                      conv.id === activeId
                        ? 'bg-chat-hover border-l-2 border-violet-500'
                        : 'hover:bg-chat-hover'
                    }`}
                    onClick={() => { onSelect(conv.id); onClose() }}
                  >
                    <MessageSquare size={14} className="flex-shrink-0 text-gray-600" />
                    <span className="flex-1 text-sm text-gray-300 truncate">{conv.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(conv.id) }}
                      className="opacity-0 group-hover/item:opacity-100 p-1 rounded hover:bg-red-900/30 text-gray-600 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
