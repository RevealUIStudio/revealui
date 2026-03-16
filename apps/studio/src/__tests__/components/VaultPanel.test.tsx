import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VaultPanel from '../../components/vault/VaultPanel';

const mockUseVault = vi.fn();

vi.mock('../../hooks/use-vault', () => ({
  useVault: () => mockUseVault(),
}));

// Mock child components to isolate VaultPanel logic
vi.mock('../../components/vault/SearchBar', () => ({
  default: ({ query, onChange }: { query: string; onChange: (q: string) => void }) => (
    <input data-testid="search-bar" value={query} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock('../../components/vault/NamespaceFilter', () => ({
  default: () => <div data-testid="namespace-filter" />,
}));
vi.mock('../../components/vault/SecretList', () => ({
  default: () => <div data-testid="secret-list" />,
}));
vi.mock('../../components/vault/SecretDetail', () => ({
  default: () => <div data-testid="secret-detail" />,
}));
vi.mock('../../components/vault/CreateSecretDialog', () => ({
  default: () => <div data-testid="create-dialog" />,
}));

describe('VaultPanel', () => {
  it('shows loading skeleton when loading', () => {
    mockUseVault.mockReturnValue({
      initialized: false,
      secrets: [],
      selectedPath: null,
      selectedValue: null,
      loading: true,
      valueLoading: false,
      error: null,
      searchQuery: '',
      activeNamespace: null,
      namespaces: [],
      initStore: vi.fn(),
      selectSecret: vi.fn(),
      createSecret: vi.fn(),
      deleteSecret: vi.fn(),
      setSearchQuery: vi.fn(),
      setActiveNamespace: vi.fn(),
    });

    const { container } = render(<VaultPanel />);

    // Skeleton has pulse animation elements
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('shows initialization screen when not initialized', () => {
    mockUseVault.mockReturnValue({
      initialized: false,
      secrets: [],
      selectedPath: null,
      selectedValue: null,
      loading: false,
      valueLoading: false,
      error: null,
      searchQuery: '',
      activeNamespace: null,
      namespaces: [],
      initStore: vi.fn(),
      selectSecret: vi.fn(),
      createSecret: vi.fn(),
      deleteSecret: vi.fn(),
      setSearchQuery: vi.fn(),
      setActiveNamespace: vi.fn(),
    });

    render(<VaultPanel />);

    expect(screen.getByText('Vault not initialized')).toBeInTheDocument();
    expect(screen.getByText('Initialize Vault')).toBeInTheDocument();
  });

  it('calls initStore when Initialize Vault button is clicked', () => {
    const initStore = vi.fn();
    mockUseVault.mockReturnValue({
      initialized: false,
      secrets: [],
      selectedPath: null,
      selectedValue: null,
      loading: false,
      valueLoading: false,
      error: null,
      searchQuery: '',
      activeNamespace: null,
      namespaces: [],
      initStore,
      selectSecret: vi.fn(),
      createSecret: vi.fn(),
      deleteSecret: vi.fn(),
      setSearchQuery: vi.fn(),
      setActiveNamespace: vi.fn(),
    });

    render(<VaultPanel />);

    fireEvent.click(screen.getByText('Initialize Vault'));
    expect(initStore).toHaveBeenCalledOnce();
  });

  it('shows main vault UI when initialized', () => {
    mockUseVault.mockReturnValue({
      initialized: true,
      secrets: [{ path: 'stripe/key', namespace: 'stripe' }],
      selectedPath: null,
      selectedValue: null,
      loading: false,
      valueLoading: false,
      error: null,
      searchQuery: '',
      activeNamespace: null,
      namespaces: ['stripe'],
      initStore: vi.fn(),
      selectSecret: vi.fn(),
      createSecret: vi.fn(),
      deleteSecret: vi.fn(),
      setSearchQuery: vi.fn(),
      setActiveNamespace: vi.fn(),
    });

    render(<VaultPanel />);

    expect(screen.getByText('New Secret')).toBeInTheDocument();
    expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    expect(screen.getByTestId('namespace-filter')).toBeInTheDocument();
    expect(screen.getByTestId('secret-list')).toBeInTheDocument();
  });

  it('opens create dialog when New Secret is clicked', () => {
    mockUseVault.mockReturnValue({
      initialized: true,
      secrets: [],
      selectedPath: null,
      selectedValue: null,
      loading: false,
      valueLoading: false,
      error: null,
      searchQuery: '',
      activeNamespace: null,
      namespaces: [],
      initStore: vi.fn(),
      selectSecret: vi.fn(),
      createSecret: vi.fn(),
      deleteSecret: vi.fn(),
      setSearchQuery: vi.fn(),
      setActiveNamespace: vi.fn(),
    });

    render(<VaultPanel />);

    fireEvent.click(screen.getByText('New Secret'));
    expect(screen.getByTestId('create-dialog')).toBeInTheDocument();
  });
});
