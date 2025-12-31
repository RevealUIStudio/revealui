"use client"
import React, { useEffect, useState } from "react"
import { useChat } from "../../hooks/useChat"

type Role = "user" | "assistant"

interface Message {
  role: Role
  content: string
}

const ChatGPTAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState<string>("")
  const {
    sendMessage,
    transcript,
    startVoiceRecognition,
    stopVoiceRecognition,
  } = useChat()

  const handleSend = async () => {
    if (!input.trim()) return
    const response: string = await sendMessage(input)
    setMessages([
      ...messages,
      { role: "user", content: input },
      { role: "assistant", content: response },
    ])
    setInput("")
  }

  const handleVoiceStart = () => {
    startVoiceRecognition()
  }

  const handleVoiceStop = () => {
    stopVoiceRecognition()
    if (transcript) {
      setMessages([...messages, { role: "user", content: transcript }])
      setInput(transcript)
    }
  }

  useEffect(() => {
    const scanCodebase = async () => {
      try {
        const response = await fetch("/api/scan-codebase")
        const data: { summary: string } = await response.json()
        await sendMessage(`Codebase scanned: \n${data.summary}`)
      } catch (error) {
        // Error scanning codebase - silently fail
        // Component will still work without initial scan
      }
    }

    scanCodebase()
    // Adding sendMessage to dependency array to prevent potential issues
  }, [sendMessage])

  return (
    <>
      <div className="flex flex-col h-96 border border-gray-300 rounded-lg p-4 bg-white dark:bg-black shadow-md">
        <div className="flex-1 overflow-y-auto space-y-4 p-2 border-b border-gray-200">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-2 rounded-md text-white ${
                msg.role === "user"
                  ? "bg-blue-500 text-right self-end"
                  : "bg-gray-600 text-left self-start"
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col space-y-2 bg-white dark:bg-black">
          <textarea
            className="w-full p-2 border rounded-md border-gray-300 dark:border-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setInput(e.target.value)
            }
            rows={3}
            placeholder="Type your message..."
          />

          <div className="flex space-x-2">
            <button
              className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
              onClick={handleSend}
            >
              Send
            </button>
            <button
              className="flex-1 bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors"
              onClick={handleVoiceStart}
            >
              Start Voice
            </button>
            <button
              className="flex-1 bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition-colors"
              onClick={handleVoiceStop}
            >
              Stop Voice
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default ChatGPTAssistant
