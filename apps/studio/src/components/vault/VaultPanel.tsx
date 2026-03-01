import { useState } from 'react'
import { useVault } from '../../hooks/use-vault'
import CreateSecretDialog from './CreateSecretDialog'
import NamespaceFilter from './NamespaceFilter'
import SearchBar from './SearchBar'
import SecretDetail from './SecretDetail'
import SecretList from './SecretList'

export default function VaultPanel() {
  const {
    initialized,
    secrets,
    selectedPath,
    selectedValue,
    loading,
    valueLoading,
    error,
    searchQuery,
    activeNamespace,
    namespaces,
    initStore,
    selectSecret,
    createSecret,
    deleteSecret,
    setSearchQuery,
    setActiveNamespace,
  } = useVault()

  const [showCreate, setShowCreate] = useState(false)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-neutral-500">Loading vault...</p>
      </div>
    )
  }

  if (!initialized) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-neutral-800">
          <svg
            className="size-6 text-neutral-400"
            aria-hidden="true"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-base font-semibold text-neutral-200">Vault not initialized</h3>
          <p className="mt-1 text-sm text-neutral-500">
            Initialize the passage-store to start managing secrets
          </p>
        </div>
        {error && <p className="max-w-sm text-center text-sm text-red-400">{error}</p>}
        <button
          type="button"
          onClick={initStore}
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500"
        >
          Initialize Vault
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchBar query={searchQuery} onChange={setSearchQuery} />
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500"
        >
          <svg
            className="size-4"
            aria-hidden="true"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Secret
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Three-column layout: Namespace | List | Detail */}
      <div className="flex flex-1 gap-0 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/30">
        <div className="w-44 flex-shrink-0 border-r border-neutral-800 p-3">
          <NamespaceFilter
            namespaces={namespaces}
            active={activeNamespace}
            onChange={setActiveNamespace}
          />
        </div>

        <div className="flex w-64 flex-shrink-0 flex-col border-r border-neutral-800 p-3">
          <SecretList
            secrets={secrets}
            selectedPath={selectedPath}
            onSelect={selectSecret}
            onDelete={deleteSecret}
          />
        </div>

        <SecretDetail path={selectedPath} value={selectedValue} loading={valueLoading} />
      </div>

      {showCreate && (
        <CreateSecretDialog onConfirm={createSecret} onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}
