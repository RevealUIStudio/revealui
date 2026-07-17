import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseLicense = vi.fn();
vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => mockUseLicense(),
}));

vi.mock('@/lib/utils/csrf', () => ({
  apiFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
}));

import { ALL_PROVIDERS, visibleProviders } from '@/lib/settings/api-key-providers';
import ApiKeysPageClient from '../api-keys-client';

function mockFetchOnce(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLicense.mockReturnValue({ features: { ai: true }, isLoading: false });
});

describe('ApiKeysPageClient', () => {
  it('offers Anthropic and OpenAI alongside the open-model providers on self-hosted', () => {
    vi.stubGlobal('fetch', mockFetchOnce(null));
    render(<ApiKeysPageClient providers={ALL_PROVIDERS} isHosted={false} />);

    expect(screen.getByRole('option', { name: 'Anthropic' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'OpenAI' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Ollama/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Inference Snaps/ })).toBeInTheDocument();
    expect(screen.queryByText(/hosted deployment/)).not.toBeInTheDocument();
  });

  it('hides local-only providers and shows the hosted hint on a hosted deployment', () => {
    vi.stubGlobal('fetch', mockFetchOnce(null));
    const hostedProviders = visibleProviders(true, {
      anthropic: true,
      openai: true,
      groq: true,
      huggingface: true,
      ollama: false,
      'inference-snaps': false,
    });
    render(<ApiKeysPageClient providers={hostedProviders} isHosted={true} />);

    expect(screen.getByRole('option', { name: 'Anthropic' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'OpenAI' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Ollama/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Inference Snaps/ })).not.toBeInTheDocument();
    expect(screen.getByText(/hosted deployment/)).toBeInTheDocument();
  });

  it('shows the get-key link pointing at the active provider docs', () => {
    vi.stubGlobal('fetch', mockFetchOnce(null));
    render(<ApiKeysPageClient providers={ALL_PROVIDERS} isHosted={false} />);

    const link = screen.getByRole('link', { name: /Get key/ });
    expect(link).toHaveAttribute('href', 'https://console.anthropic.com/settings/keys');

    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'openai' } });
    expect(screen.getByRole('link', { name: /Get key/ })).toHaveAttribute(
      'href',
      'https://platform.openai.com/api-keys',
    );
  });

  it('renders the honest "will use it" banner once a key is configured', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ provider: 'anthropic', keyHint: 'sk-ant-...abcd' }));
    render(<ApiKeysPageClient providers={ALL_PROVIDERS} isHosted={false} />);

    await waitFor(() => {
      expect(screen.getByText(/Agent tasks will use it\./)).toBeInTheDocument();
    });
    expect(screen.getByText(/Anthropic key configured \(sk-ant-...abcd\)/)).toBeInTheDocument();
  });
});
