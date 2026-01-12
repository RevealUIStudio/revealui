/**
 * useChat Hook - Client-side chat interface
 *
 * This hook provides a safe client-side interface to the server-side OpenAI API
 * All API keys remain server-side, preventing exposure
 */

import { useState } from 'react'

interface SpeechRecognitionEvent {
  results: {
    [key: number]: {
      [key: number]: {
        transcript: string
      }
    }
  }
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

interface SpeechRecognitionInstance {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: (event: SpeechRecognitionEvent) => void
  start: () => void
  stop: () => void
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export function useChat(): {
  sendMessage: (message: string) => Promise<string>
  transcript: string
  startVoiceRecognition: () => void
  stopVoiceRecognition: () => void
  isLoading: boolean
} {
  const [transcript, setTranscript] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  /**
   * Send message to server-side chat API
   * This keeps API keys secure on the server
   */
  const sendMessage = async (message: string): Promise<string> => {
    if (!message || message.length > 4000) {
      return 'Error: Invalid message length'
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      })

      const data = (await response.json()) as { error?: string; message?: string }

      if (!response.ok) {
        return data.error || 'Error: Unable to get a response.'
      }

      return data.message || 'Error: No response received.'
    } catch {
      return 'Error: Unable to connect. Please try again later.'
    } finally {
      setIsLoading(false)
    }
  }

  // Voice recognition setup using Web Speech API
  const startVoiceRecognition = (): void => {
    const SpeechRecognition =
      (typeof window !== 'undefined' &&
        (window.SpeechRecognition || window.webkitSpeechRecognition)) ||
      undefined

    if (!SpeechRecognition) {
      // Speech recognition not supported - silently return
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const speechResult = event.results[0]?.[0]?.transcript || ''
      setTranscript(speechResult)
    }

    recognition.start()
  }

  const stopVoiceRecognition = (): void => {
    const SpeechRecognition =
      (typeof window !== 'undefined' &&
        (window.SpeechRecognition || window.webkitSpeechRecognition)) ||
      undefined

    if (!SpeechRecognition) {
      // Speech recognition not supported - silently return
      return
    }

    const recognition = new SpeechRecognition()
    recognition.stop()
  }

  return {
    sendMessage,
    transcript,
    startVoiceRecognition,
    stopVoiceRecognition,
    isLoading,
  }
}
