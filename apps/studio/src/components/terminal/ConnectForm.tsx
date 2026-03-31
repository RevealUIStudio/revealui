import { open } from '@tauri-apps/plugin-dialog';
import { useCallback, useEffect, useState } from 'react';
import { sshBookmarkDelete, sshBookmarkList, sshBookmarkSave } from '../../lib/invoke';
import type { SshAuth, SshBookmark, SshConnectParams } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface ConnectFormProps {
  onConnect: (params: SshConnectParams) => void;
  connecting: boolean;
}

type AuthMethod = 'password' | 'key';

export default function ConnectForm({ onConnect, connecting }: ConnectFormProps) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('key');
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [bookmarks, setBookmarks] = useState<SshBookmark[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(true);

  const loadBookmarks = useCallback(async () => {
    try {
      const list = await sshBookmarkList();
      setBookmarks(list);
    } catch {
      // Bookmarks unavailable outside Tauri
    }
  }, []);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  const handleBrowseKey = async () => {
    const selected = await open({
      title: 'Select SSH key',
      multiple: false,
      directory: false,
    });
    if (selected) {
      setKeyPath(selected);
    }
  };

  const handleSelectBookmark = (b: SshBookmark) => {
    setHost(b.host);
    setPort(b.port);
    setUsername(b.username);
    setAuthMethod(b.auth_method as AuthMethod);
    if (b.key_path) setKeyPath(b.key_path);
    setShowBookmarks(false);
  };

  const handleDeleteBookmark = async (id: string) => {
    await sshBookmarkDelete(id);
    await loadBookmarks();
  };

  const handleSaveBookmark = async () => {
    const bookmark: SshBookmark = {
      id: crypto.randomUUID(),
      label: `${username}@${host}`,
      host,
      port,
      username,
      auth_method: authMethod,
      key_path: authMethod === 'key' ? keyPath : null,
    };
    await sshBookmarkSave(bookmark);
    await loadBookmarks();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let auth: SshAuth;
    if (authMethod === 'password') {
      auth = { method: 'password', password };
    } else {
      auth = { method: 'key', key_path: keyPath, passphrase: passphrase || null };
    }
    onConnect({ host, port, username, auth });
  };

  const isValid = host && username && (authMethod === 'password' ? password : keyPath);

  return (
    <div className="space-y-4">
      {/* Bookmarks */}
      {bookmarks.length > 0 && showBookmarks && (
        <div className="space-y-2">
          <span className="block text-xs font-medium text-neutral-400">Saved Connections</span>
          <div className="space-y-1">
            {bookmarks.map((b) => (
              <div
                key={b.id}
                className="group flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-800/50 px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => handleSelectBookmark(b)}
                  className="flex-1 text-left"
                >
                  <span className="text-sm text-neutral-200">{b.label}</span>
                  <span className="ml-2 text-xs text-neutral-500">
                    :{b.port} ({b.auth_method})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteBookmark(b.id)}
                  className="ml-2 text-xs text-neutral-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                >
                  remove
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-neutral-800 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowBookmarks(false)}>
              New connection
            </Button>
          </div>
        </div>
      )}

      {/* Connect form */}
      {(!showBookmarks || bookmarks.length === 0) && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {bookmarks.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowBookmarks(true)}>
              Saved connections
            </Button>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="ssh-host"
              label="Host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.138"
              required
            />
            <Input
              id="ssh-port"
              label="Port"
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              min={1}
              max={65535}
              required
            />
          </div>

          <Input
            id="ssh-username"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your-username"
            required
          />

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
            <Input
              id="ssh-password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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
                  <Input
                    id="ssh-keypath"
                    value={keyPath}
                    onChange={(e) => setKeyPath(e.target.value)}
                    placeholder="~/.ssh/id_ed25519"
                    className="min-w-0 flex-1"
                  />
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleBrowseKey}
                    className="shrink-0"
                  >
                    Browse
                  </Button>
                </div>
              </div>
              <Input
                id="ssh-passphrase"
                label="Passphrase"
                hint="optional"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Leave empty if unencrypted"
              />
            </>
          )}

          <div className="flex gap-2">
            <Button
              variant="primary"
              size="lg"
              loading={connecting}
              disabled={!isValid}
              className="flex-1"
              type="submit"
            >
              Connect
            </Button>
            {isValid && (
              <Button variant="secondary" size="lg" onClick={handleSaveBookmark}>
                Save
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
