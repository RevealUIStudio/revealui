import { useCallback, useEffect, useState } from 'react';
import { sshBookmarkDelete, sshBookmarkList, sshBookmarkSave } from '../../lib/invoke';
import type { SshBookmark, SshConnectParams } from '../../types';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Input from '../ui/Input';

interface SshBookmarkSidebarProps {
  onSelect: (params: SshConnectParams) => void;
}

export default function SshBookmarkSidebar({ onSelect }: SshBookmarkSidebarProps) {
  const [bookmarks, setBookmarks] = useState<SshBookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [label, setLabel] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [keyPath, setKeyPath] = useState('');

  const loadBookmarks = useCallback(async () => {
    try {
      setLoading(true);
      const list = await sshBookmarkList();
      setBookmarks(list);
    } catch {
      // Bookmarks unavailable outside Tauri
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  const handleConnect = (bookmark: SshBookmark) => {
    onSelect({
      host: bookmark.host,
      port: bookmark.port,
      username: bookmark.username,
      auth:
        bookmark.auth_method === 'key'
          ? { method: 'key', key_path: bookmark.key_path ?? '', passphrase: null }
          : { method: 'password', password: '' },
    });
  };

  const handleDelete = async (id: string) => {
    await sshBookmarkDelete(id);
    await loadBookmarks();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const bookmark: SshBookmark = {
      id: crypto.randomUUID(),
      label: label || `${username}@${host}`,
      host,
      port,
      username,
      auth_method: keyPath ? 'key' : 'password',
      key_path: keyPath || null,
    };
    await sshBookmarkSave(bookmark);
    await loadBookmarks();
    resetForm();
  };

  const resetForm = () => {
    setLabel('');
    setHost('');
    setPort(22);
    setUsername('');
    setKeyPath('');
    setShowForm(false);
  };

  const isFormValid = host && username;

  return (
    <div className="flex h-full w-64 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <span className="text-xs font-medium text-neutral-400">Bookmarks</span>
        <Button variant="ghost" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add'}
        </Button>
      </div>

      {/* Add bookmark form */}
      {showForm && (
        <div className="border-b border-neutral-800 p-3">
          <form onSubmit={handleAdd} className="space-y-2">
            <Input
              id="bm-label"
              label="Label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My Server"
            />
            <Input
              id="bm-host"
              label="Host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.100"
              required
            />
            <Input
              id="bm-port"
              label="Port"
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              min={1}
              max={65535}
            />
            <Input
              id="bm-username"
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
              required
            />
            <Input
              id="bm-keypath"
              label="Key path"
              hint="optional"
              value={keyPath}
              onChange={(e) => setKeyPath(e.target.value)}
              placeholder="~/.ssh/id_ed25519"
              mono
            />
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={!isFormValid}
              className="w-full"
            >
              Save Bookmark
            </Button>
          </form>
        </div>
      )}

      {/* Bookmark list */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading && bookmarks.length === 0 && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-800/50" />
            ))}
          </div>
        )}

        {!loading && bookmarks.length === 0 && !showForm && (
          <p className="px-2 py-4 text-center text-xs text-neutral-500">No saved bookmarks.</p>
        )}

        <div className="space-y-1.5">
          {bookmarks.map((bookmark) => (
            <Card key={bookmark.id} variant="default" padding="sm" className="group">
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-200">{bookmark.label}</p>
                  <p className="truncate font-mono text-xs text-neutral-500">
                    {bookmark.username}@{bookmark.host}:{bookmark.port}
                  </p>
                  <Badge
                    variant={bookmark.auth_method === 'key' ? 'info' : 'warning'}
                    size="sm"
                    className="mt-1"
                  >
                    {bookmark.auth_method}
                  </Badge>
                </div>
              </div>
              <div className="mt-2 flex gap-1.5">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleConnect(bookmark)}
                  className="flex-1"
                >
                  Connect
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(bookmark.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
