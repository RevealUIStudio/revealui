import { useState } from 'react'
import type { SshConnectParams } from '../../types'

interface ConnectFormProps {
  onConnect: (params: SshConnectParams) => void
  connecting: boolean
}

export default function ConnectForm({ onConnect, connecting }: ConnectFormProps) {
  const [host, setHost] = useState('192.168.1.138')
  const [port, setPort] = useState(22)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConnect({ host, port, username, password })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="ssh-host" className="block text-xs font-medium text-neutral-400 mb-1">
            Host
          </label>
          <input
            id="ssh-host"
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="192.168.1.138"
            required
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-orange-600 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="ssh-port" className="block text-xs font-medium text-neutral-400 mb-1">
            Port
          </label>
          <input
            id="ssh-port"
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            min={1}
            max={65535}
            required
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:border-orange-600 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label htmlFor="ssh-username" className="block text-xs font-medium text-neutral-400 mb-1">
          Username
        </label>
        <input
          id="ssh-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="joshua-v-dev"
          required
          className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-orange-600 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="ssh-password" className="block text-xs font-medium text-neutral-400 mb-1">
          Password
        </label>
        <input
          id="ssh-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:border-orange-600 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={connecting || !host || !username || !password}
        className="w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
      >
        {connecting ? 'Connecting...' : 'Connect'}
      </button>
    </form>
  )
}
