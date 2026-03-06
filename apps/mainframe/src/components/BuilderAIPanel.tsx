'use client'

import { useAgentStream } from '@revealui/ai/client'
import type { JSX } from 'react'
import { useRef, useState } from 'react'

interface BuilderAIPanelProps {
  /** Optional context describing what the user is currently building */
  buildContext?: string
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
    const req = { instruction: resolvedInstruction } as Parameters<typeof start>[0]
    if (apiKey) (req as unknown as Record<string, unknown>).apiKey = apiKey

    start(req, '/api/agent-stream')
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
