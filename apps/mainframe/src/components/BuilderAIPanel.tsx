'use client'

import type { JSX } from 'react'
import { useCallback, useRef, useState } from 'react'

interface BuilderAIPanelProps {
  /** Optional context describing what the user is currently building */
  buildContext?: string
}

interface AgentStreamChunk {
  type: 'text' | 'tool_call_start' | 'tool_call_result' | 'error' | 'done'
  content?: string
  error?: string
}

/**
 * Minimal agent streaming hook — supports an optional Authorization header
 * for BYOK (Bring Your Own Key) use. The published @revealui/ai hook does
 * not accept custom headers, so we implement the fetch loop here.
 */
function useAgentStream() {
  const [text, setText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const abort = useCallback(() => {
    controllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  const reset = useCallback(() => {
    controllerRef.current?.abort()
    setText('')
    setError(null)
    setIsStreaming(false)
  }, [])

  const start = useCallback(async (instruction: string, apiKey?: string) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setText('')
    setError(null)
    setIsStreaming(true)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }

    try {
      const response = await fetch('/api/agent-stream', {
        method: 'POST',
        headers,
        body: JSON.stringify({ instruction }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errText = await response.text()
        setError(`HTTP ${response.status}: ${errText}`)
        setIsStreaming(false)
        return
      }

      if (!response.body) {
        setError('No response body')
        setIsStreaming(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const event of events) {
          const dataLine = event.split('\n').find((l) => l.startsWith('data: '))
          if (!dataLine) continue
          try {
            const chunk = JSON.parse(dataLine.slice(6)) as AgentStreamChunk
            if (chunk.type === 'text') setText((t) => t + (chunk.content ?? ''))
            if (chunk.type === 'error') setError(chunk.error ?? 'Unknown error')
            if (chunk.type === 'done' || chunk.type === 'error') setIsStreaming(false)
          } catch {
            // Malformed SSE data — skip
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setIsStreaming(false)
        return
      }
      setError(err instanceof Error ? err.message : String(err))
      setIsStreaming(false)
    }
  }, [])

  return { text, isStreaming, error, start, abort, reset }
}

export function BuilderAIPanel({ buildContext }: BuilderAIPanelProps): JSX.Element {
  const { text, isStreaming, error, start, abort, reset } = useAgentStream()
  const [input, setInput] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    const instruction = input.trim()
    if (!instruction || isStreaming) return

    const resolvedInstruction = buildContext
      ? `Context: ${buildContext}\n\n${instruction}`
      : instruction

    // BYOK key is sent via Authorization header, never in the request body
    void start(resolvedInstruction, apiKey || undefined)
    setInput('')
  }

  return (
    <div className="border border-purple-200 rounded-lg bg-purple-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-purple-100 border-b border-purple-200">
        <h3 className="text-sm font-semibold text-purple-800">RevealUI AI Assistant</h3>
        <button
          type="button"
          onClick={() => setShowKeyInput((v) => !v)}
          className="text-xs text-purple-600 hover:text-purple-800 underline"
          title="Configure BYOK API key"
        >
          {showKeyInput ? 'Hide key' : 'API key'}
        </button>
      </div>

      {showKeyInput && (
        <div className="px-4 py-2 bg-white border-b border-purple-100">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your GROQ / Anthropic API key…"
            className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
        </div>
      )}

      {/* Response area */}
      <div className="px-4 py-3 min-h-[120px] max-h-[240px] overflow-y-auto text-sm text-gray-800 whitespace-pre-wrap">
        {text || <span className="text-gray-400 italic">Ask me to help you build something…</span>}
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-0.5 align-text-bottom" />
        )}
        {error && <p className="text-red-600 mt-1">{error}</p>}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 px-4 py-2 border-t border-purple-100 bg-white"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the AI assistant…"
          disabled={isStreaming}
          className="flex-1 text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400 disabled:opacity-50"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={abort}
            className="px-3 py-1.5 text-xs font-medium rounded bg-red-100 text-red-700 hover:bg-red-200"
          >
            Stop
          </button>
        ) : (
          <>
            {text && (
              <button
                type="button"
                onClick={reset}
                className="px-2 py-1.5 text-xs font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
            >
              Send
            </button>
          </>
        )}
      </form>
    </div>
  )
}
