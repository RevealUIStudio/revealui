'use client'
import { useChat } from '@ai-sdk/react'
import type React from 'react'
import { useEffect, useState } from 'react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface UseChatReturn {
  messages: ChatMessage[]
  input: string
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  error: Error | null
}

const ChatGPTAssistant: React.FC = () => {
  const chatOptions = { api: '/api/chat' }
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat(
    chatOptions,
  ) as UseChatReturn

  const [transcript, setTranscript] = useState<string>('')
  const [isListening, setIsListening] = useState(false)

  const handleVoiceStart = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      // SpeechRecognition API not fully typed in TypeScript, accessing via window with proper interface
      type SpeechRecognitionConstructor = new () => SpeechRecognition

      type WindowWithSpeechRecognition = Window & {
        SpeechRecognition?: SpeechRecognitionConstructor
        webkitSpeechRecognition?: SpeechRecognitionConstructor
      }
      const SpeechRecognitionClass =
        (window as WindowWithSpeechRecognition).SpeechRecognition ||
        (window as WindowWithSpeechRecognition).webkitSpeechRecognition
      const recognition = new SpeechRecognitionClass!()
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const current = event.resultIndex
        const transcriptText = event.results[current][0].transcript
        setTranscript(transcriptText)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.start()
      setIsListening(true)
    }
  }

  const handleVoiceStop = () => {
    if (isListening) {
      // Stop recognition will be handled by onend event
      setIsListening(false)
      if (transcript) {
        // Set the transcript as input
        handleInputChange({
          target: { value: transcript },
        } as React.ChangeEvent<HTMLTextAreaElement>)
        setTranscript('')
      }
    }
  }

  useEffect(() => {
    const scanCodebase = async () => {
      try {
        const response = await fetch('/api/scan-codebase')
        const data: { summary: string } = await response.json()
        // Send initial message with codebase summary
        handleInputChange({
          target: { value: `Codebase scanned: \n${data.summary}` },
        } as React.ChangeEvent<HTMLTextAreaElement>)
      } catch (_error) {
        // Error scanning codebase - silently fail
        // Component will still work without initial scan
      }
    }

    scanCodebase()
  }, [handleInputChange])

  return (
    <div className="flex flex-col h-96 border border-gray-300 rounded-lg p-4 bg-white dark:bg-black shadow-md">
      <div className="flex-1 overflow-y-auto space-y-4 p-2 border-b border-gray-200">
        {messages.length === 0 && (
          <div className="text-gray-500 text-center py-4">
            Start a conversation by typing a message below
          </div>
        )}
        {messages.map((msg: ChatMessage) => (
          <div
            key={msg.id}
            className={`p-2 rounded-md text-white ${
              msg.role === 'user'
                ? 'bg-blue-500 text-right self-end ml-auto max-w-[80%]'
                : 'bg-gray-600 text-left self-start max-w-[80%]'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="p-2 rounded-md bg-gray-600 text-white text-left self-start max-w-[80%]">
            Thinking...
          </div>
        )}
        {error && (
          <div className="p-2 rounded-md bg-red-500 text-white text-left self-start max-w-[80%]">
            Error: {error.message}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col space-y-2 bg-white dark:bg-black">
        <textarea
          className="w-full p-2 border rounded-md border-gray-300 dark:border-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={input}
          onChange={handleInputChange}
          rows={3}
          placeholder="Type your message..."
          disabled={isLoading}
        />

        <div className="flex space-x-2">
          <button
            type="submit"
            className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
          <button
            type="button"
            className="flex-1 bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors disabled:opacity-50"
            onClick={handleVoiceStart}
            disabled={isListening || isLoading}
          >
            {isListening ? 'Listening...' : 'Start Voice'}
          </button>
          <button
            type="button"
            className="flex-1 bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
            onClick={handleVoiceStop}
            disabled={!isListening}
          >
            Stop Voice
          </button>
        </div>
      </form>
    </div>
  )
}

export default ChatGPTAssistant
