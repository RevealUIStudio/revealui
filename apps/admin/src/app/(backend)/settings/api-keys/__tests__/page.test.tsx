import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseLicense = vi.fn();
vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => mockUseLicense(),
}));

vi.mock('@/lib/utils/csrf', () => ({
  apiFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
}));

import ApiKeysPage from '../page';

const ORIGINAL_LICENSE_KEY = process.env.REVEALUI_LICENSE_PRIVATE_KEY;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (ORIGINAL_LICENSE_KEY === undefined) {
    delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;
  } else {
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = ORIGINAL_LICENSE_KEY;
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLicense.mockReturnValue({ features: { ai: true }, isLoading: false });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(null) }),
  );
});

describe('ApiKeysPage (server shell)', () => {
  it('offers all six providers when REVEALUI_LICENSE_PRIVATE_KEY is unset (self-hosted)', async () => {
    delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;

    const element = await ApiKeysPage();
    render(element);

    expect(screen.getByRole('option', { name: /Ollama/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Inference Snaps/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Anthropic' })).toBeInTheDocument();
  });

  it('hides localhost-only providers when REVEALUI_LICENSE_PRIVATE_KEY is set (hosted)', async () => {
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'test-private-key';

    const element = await ApiKeysPage();
    render(element);

    expect(screen.queryByRole('option', { name: /Ollama/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Inference Snaps/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Anthropic' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'OpenAI' })).toBeInTheDocument();
  });
});
