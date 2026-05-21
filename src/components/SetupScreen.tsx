import React, { useState, useEffect, useCallback } from 'react'
import { Sparkles, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  onReady: () => void
}

export default function SetupScreen({ onReady }: Props) {
  const [status, setStatus] = useState<SetupStatus>({
    step: 'searching',
    message: '正在检测 Claude Code 环境...',
  })
  const [result, setResult] = useState<SetupResult | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [dots, setDots] = useState('')

  // Animated dots
  useEffect(() => {
    if (status.step === 'searching' || status.step === 'validating') {
      const timer = setInterval(() => {
        setDots(prev => prev.length >= 3 ? '' : prev + '.')
      }, 400)
      return () => clearInterval(timer)
    }
    setDots('')
  }, [status.step])

  // Listen for status updates + poll for result
  useEffect(() => {
    const unsub = window.setup.onStatus((data) => {
      setStatus(data as SetupStatus)
    })

    const poll = async () => {
      const res = await window.setup.getResult()
      if (res) {
        setResult(res)
        if (res.ok) {
          setStatus({ step: 'done', message: `就绪！${res.version}` })
          setTimeout(() => onReady(), 800)
        }
      }
    }

    poll()
    const interval = setInterval(poll, 800)

    return () => {
      unsub()
      clearInterval(interval)
    }
  }, [onReady])

  const handleRetry = useCallback(async () => {
    setRetrying(true)
    setResult(null)
    setStatus({ step: 'searching', message: '正在重新检测...' })
    await window.setup.retry()
    const res = await window.setup.getResult()
    if (res) {
      setResult(res)
      if (res.ok) {
        setTimeout(() => onReady(), 800)
      }
    }
    setRetrying(false)
  }, [onReady])

  const isLoading = status.step === 'searching' || status.step === 'validating'
  const isDone = status.step === 'done'
  const isError = status.step === 'error'

  return (
    <div className="h-screen flex items-center justify-center bg-chat-bg">
      <div className="text-center max-w-md px-6">
        {/* Icon */}
        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg ${
          isDone
            ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-900/30'
            : isError
              ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-900/30'
              : 'bg-gradient-to-br from-violet-600 to-purple-700 shadow-violet-900/30'
        } ${isLoading ? 'animate-pulse' : ''}`}>
          {isDone ? (
            <CheckCircle size={36} className="text-white" />
          ) : isError ? (
            <AlertCircle size={36} className="text-white" />
          ) : (
            <Sparkles size={36} className="text-white" />
          )}
        </div>

        {/* Title */}
        <h1 className="text-xl font-semibold text-white mb-2">Claude Chat</h1>

        {/* Status */}
        <p className={`text-sm mb-6 ${
          isDone ? 'text-green-400' : isError ? 'text-red-400' : 'text-gray-400'
        }`}>
          {isLoading ? `${status.message}${dots}` : status.message}
        </p>

        {/* Progress bar (loading) */}
        {isLoading && (
          <div className="w-48 h-1 bg-chat-border rounded-full mx-auto mb-6 overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]"
              style={{ width: status.step === 'validating' ? '70%' : '35%', transition: 'width 0.5s ease' }}
            />
          </div>
        )}

        {/* Error: install instructions */}
        {isError && (
          <div className="mt-4 space-y-4">
            <div className="bg-chat-surface border border-chat-border rounded-xl p-4 text-left">
              <p className="text-sm text-gray-300 mb-3">请安装 Claude Code 后重试：</p>
              <div className="bg-[#161616] rounded-lg px-3 py-2 font-mono text-xs text-violet-300 mb-3">
                npm install -g @anthropic-ai/claude-code
              </div>
              <p className="text-xs text-gray-500">
                安装后需要运行 <code className="text-violet-400">claude</code> 完成首次认证。
              </p>
            </div>

            <button
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm transition-colors"
            >
              <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} />
              {retrying ? '检测中...' : '重新检测'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
