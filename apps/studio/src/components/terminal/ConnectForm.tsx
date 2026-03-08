import { open } from '@tauri-apps/plugin-dialog'
import { useState } from 'react'
import type { SshAuth, SshConnectParams } from '../../types'

interface ConnectFormProps {
  onConnect: (params: SshConnectParams) => void
  connecting: boolean
}

type AuthMethod = 'password' | 'key'

export default function ConnectForm({ onConnect, connecting }: ConnectFormProps) {
  const [host, setHost] = useState('')
  const [port, setPort] = useState(22)
  const [username, setUsername] = useState('')
  const [authMethod, setAuthMethod] = useState<AuthMethod>('key')
  const [password, setPassword] = useState('')
  const [keyPath, setKeyPath] = useState('')
  const [passphrase, setPassphrase] = useState('')

  const handleBrowseKey = async () => {
    const selected = await open({
      title: 'Select SSH key',
      multiple: false,
      directory: false,
    })
    if (selected) {
      setKeyPath(selected)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    let auth: SshAuth
    if (authMethod === 'password') {
      auth = { method: 'password', password }
    } else {
      auth = { method: 'key', key_path: keyPath, passphrase: passphrase || null }
    }
    onConnect({ host, port, username, auth })
  }

  const isValid = host && username && (authMethod === 'password' ? password : keyPath)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="ssh-host" className="mb-1 block text-xs font-medium text-neutral-400">
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
          <label htmlFor="ssh-port" className="mb-1 block text-xs font-medium text-neutral-400">
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
        <label htmlFor="ssh-username" className="mb-1 block text-xs font-medium text-neutral-400">
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

      {/* Auth method toggle */}
      <div>
        <span className="mb-2 block text-xs font-medium text-neutral-400">Authentication</span>
        <div className="flex gap-1 rounded-md border border-neutral-700 bg-neutral-800 p-1">
          <button
            type="button"
            onClick={() => setAuthMethod('key')}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              authMethod === 'key'
                ? 'bg-neutral-700 text-neutral-100'
                : 'text-neutral-400 hover:text-neutral-300'
            }`}
          >
            SSH Key
          </button>
          <button
            type="button"
            onClick={() => setAuthMethod('password')}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              authMethod === 'password'
                ? 'bg-neutral-700 text-neutral-100'
                : 'text-neutral-400 hover:text-neutral-300'
            }`}
          >
            Password
          </button>
        </div>
      </div>

      {authMethod === 'password' ? (
        <div>
          <label htmlFor="ssh-password" className="mb-1 block text-xs font-medium text-neutral-400">
            Password
          </label>
          <input
            id="ssh-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:border-orange-600 focus:outline-none"
          />
        </div>
      ) : (
        <>
          <div>
            <label
              htmlFor="ssh-keypath"
              className="mb-1 block text-xs font-medium text-neutral-400"
            >
              Key file
            </label>
            <div className="flex gap-2">
              <input
                id="ssh-keypath"
                type="text"
                value={keyPath}
                onChange={(e) => setKeyPath(e.target.value)}
                placeholder="~/.ssh/id_ed25519"
                className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-orange-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleBrowseKey}
                className="shrink-0 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-700"
              >
                Browse
              </button>
            </div>
          </div>
          <div>
            <label
              htmlFor="ssh-passphrase"
              className="mb-1 block text-xs font-medium text-neutral-400"
            >
              Passphrase
              <span className="ml-1 text-neutral-500">(optional)</span>
            </label>
            <input
              id="ssh-passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Leave empty if unencrypted"
              className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-orange-600 focus:outline-none"
            />
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={connecting || !isValid}
        className="w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
      >
        {connecting ? 'Connecting...' : 'Connect'}
      </button>
    </form>
  )
}
