'use client';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Web Speech API type definitions (custom types to avoid conflicts)
interface CustomSpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface CustomSpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): CustomSpeechRecognitionAlternative;
  [index: number]: CustomSpeechRecognitionAlternative;
}

interface CustomSpeechRecognitionResultList {
  readonly length: number;
  item(index: number): CustomSpeechRecognitionResult;
  [index: number]: CustomSpeechRecognitionResult;
}

interface CustomSpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: CustomSpeechRecognitionResultList;
}

interface CustomSpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: CustomSpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type CustomSpeechRecognition = new () => CustomSpeechRecognitionInstance;

let messageCounter = 0;
function nextId() {
  return `msg-${++messageCounter}`;
}

const AgentChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isListening, setIsListening] = useState(false);
  const transcriptRef = useRef('');

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const content = input.trim();
      if (!content || isLoading) return;

      const userMessage: ChatMessage = { id: nextId(), role: 'user', content };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setInput('');
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: nextMessages.map(({ role, content: c }) => ({ role, content: c })),
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Chat request failed: ${res.status} ${text}`);
        }

        const data = (await res.json()) as { content: string };
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: 'assistant', content: data.content },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages],
  );

  const handleVoiceStart = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      type WindowWithSpeechRecognition = Window & {
        // biome-ignore lint/style/useNamingConvention: SpeechRecognition matches the Web Speech API browser property name
        SpeechRecognition?: CustomSpeechRecognition;
        webkitSpeechRecognition?: CustomSpeechRecognition;
      };
      const SpeechRecognitionClass =
        (window as WindowWithSpeechRecognition).SpeechRecognition ||
        (window as WindowWithSpeechRecognition).webkitSpeechRecognition;
      if (!SpeechRecognitionClass) return;
      const recognition =
        new SpeechRecognitionClass() as unknown as CustomSpeechRecognitionInstance;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: CustomSpeechRecognitionEvent) => {
        const current = event.resultIndex;
        const result = event.results[current];
        if (result?.[0]) {
          transcriptRef.current = result[0].transcript;
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (transcriptRef.current) {
          setInput(transcriptRef.current);
          transcriptRef.current = '';
        }
      };

      recognition.start();
      setIsListening(true);
    }
  };

  const handleVoiceStop = () => {
    if (isListening) {
      setIsListening(false);
    }
  };

  return (
    <div className="flex h-96 flex-col rounded-lg border border-gray-300 bg-white p-4 shadow-md dark:bg-black">
      <div className="flex-1 space-y-4 overflow-y-auto border-b border-gray-200 p-2">
        {messages.length === 0 && (
          <div className="py-4 text-center text-gray-500">
            Start a conversation by typing a message below
          </div>
        )}
        {messages.map((msg: ChatMessage) => (
          <div
            key={msg.id}
            className={`rounded-md p-2 text-white ${
              msg.role === 'user'
                ? 'ml-auto max-w-[80%] self-end bg-blue-500 text-right'
                : 'max-w-[80%] self-start bg-gray-600 text-left'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="max-w-[80%] self-start rounded-md bg-gray-600 p-2 text-left text-white">
            Thinking...
          </div>
        )}
        {error && (
          <div className="max-w-[80%] self-start rounded-md bg-red-500 p-2 text-left text-white">
            Error: {error.message}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col space-y-2 bg-white dark:bg-black">
        <textarea
          className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-50"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="Type your message..."
          disabled={isLoading}
        />

        <div className="flex space-x-2">
          <button
            type="submit"
            className="flex-1 rounded-md bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
          <button
            type="button"
            className="flex-1 rounded-md bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600 disabled:opacity-50"
            onClick={handleVoiceStart}
            disabled={isListening || isLoading}
          >
            {isListening ? 'Listening...' : 'Start Voice'}
          </button>
          <button
            type="button"
            className="flex-1 rounded-md bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-600 disabled:opacity-50"
            onClick={handleVoiceStop}
            disabled={!isListening}
          >
            Stop Voice
          </button>
        </div>
      </form>
    </div>
  );
};

export default AgentChat;
