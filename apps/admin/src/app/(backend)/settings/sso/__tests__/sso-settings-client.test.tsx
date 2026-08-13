import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseLicense = vi.fn();

vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => mockUseLicense(),
}));

vi.mock('@/lib/components/LicenseGate', () => ({
  LicenseGate: ({ feature, children }: { feature: string; children: ReactNode }) => {
    const { features, isLoading } = mockUseLicense() as {
      features: Record<string, boolean> | null;
      isLoading: boolean;
    };
    if (isLoading) return <div>loading</div>;
    if (!(features?.[feature] ?? false)) {
      return <div>Enterprise SSO requires upgrade</div>;
    }
    return <>{children}</>;
  },
}));

// Partial mock: keep real presentation exports (icons, etc.) so GAP-479
// consumers that touch the presentation barrel do not fail on missing names.
vi.mock('@revealui/presentation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@revealui/presentation')>();
  return {
    ...actual,
    Button: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
    Select: ({
      children,
      ...props
    }: React.SelectHTMLAttributes<HTMLSelectElement> & { children?: ReactNode }) => (
      <select {...props}>{children}</select>
    ),
  };
});

vi.mock('@revealui/presentation/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@revealui/presentation/client')>();
  return {
    ...actual,
    Field: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Label: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
      <span {...props}>{children}</span>
    ),
    Checkbox: ({
      checked,
      onChange,
    }: {
      checked?: boolean;
      onChange?: (checked: boolean) => void;
    }) => (
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        aria-label="checkbox"
      />
    ),
    Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
  };
});

vi.mock('@/lib/utils/csrf', () => ({
  apiFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
}));

import SsoSettingsClient, { providerToForm, type SsoProvider } from '../sso-settings-client';

const PROVIDER: SsoProvider = {
  id: 'sso_1',
  accountId: 'acct-1',
  providerType: 'oidc',
  name: 'Okta',
  enabled: false,
  issuer: 'https://idp.example.com',
  discoveryUrl: null,
  clientId: 'client-1',
  clientSecretRef: 'REVEALUI_SSO_CLIENT_SECRET',
  samlMetadataUrl: null,
  samlMetadataXml: null,
  samlSpEntityId: null,
  hasSigningCert: false,
  groupClaim: 'groups',
  groupRoleMap: {},
  defaultRole: 'member',
  requireGroupMatch: false,
  allowPasswordFallback: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SAML_PROVIDER: SsoProvider = {
  ...PROVIDER,
  id: 'sso_saml_1',
  providerType: 'saml',
  name: 'Azure SAML',
  issuer: 'https://sts.windows.net/tenant/',
  clientId: null,
  clientSecretRef: null,
  samlMetadataUrl: 'https://idp.example.com/metadata.xml',
  samlMetadataXml: null,
  samlSpEntityId: null,
  hasSigningCert: true,
};

function mockFetchSequence(
  handlers: Array<(url: string, init?: RequestInit) => Promise<Response> | Response>,
) {
  if (handlers.length === 0) {
    throw new Error('mockFetchSequence requires at least one handler');
  }
  let i = 0;
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const index = Math.min(i, handlers.length - 1);
    const handler = handlers[index];
    i += 1;
    if (!handler) {
      throw new Error(`mockFetchSequence: missing handler at index ${index}`);
    }
    return handler(url, init);
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLicense.mockReturnValue({ features: { sso: true }, isLoading: false });
});

describe('providerToForm', () => {
  it('maps provider fields into form state', () => {
    const form = providerToForm(PROVIDER);
    expect(form.name).toBe('Okta');
    expect(form.clientSecretRef).toBe('REVEALUI_SSO_CLIENT_SECRET');
    expect(form.enabled).toBe(false);
  });
});

describe('SsoSettingsClient', () => {
  it('shows upgrade gate when sso feature is false', () => {
    mockUseLicense.mockReturnValue({ features: { sso: false }, isLoading: false });
    vi.stubGlobal('fetch', vi.fn());
    render(<SsoSettingsClient />);
    expect(screen.getByText(/Enterprise SSO requires upgrade/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add provider/i })).not.toBeInTheDocument();
  });

  it('lists providers after bootstrap', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        () =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ accountId: 'acct-1', ssoFeature: true, membershipRole: 'owner' }),
          } as Response),
        () =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ providers: [PROVIDER] }),
          } as Response),
      ]),
    );

    render(<SsoSettingsClient />);

    await waitFor(() => {
      expect(screen.getByText('Okta')).toBeInTheDocument();
    });
    expect(screen.getByText('https://idp.example.com')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('opens create form with OIDC fields and secret-ref hint by default', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        () =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ accountId: 'acct-1', ssoFeature: true, membershipRole: 'owner' }),
          } as Response),
        () =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ providers: [] }),
          } as Response),
      ]),
    );

    render(<SsoSettingsClient />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add provider/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add provider/i }));
    expect(screen.getByText(/Add OIDC provider/i)).toBeInTheDocument();
    expect(screen.getByText(/Never paste the secret value/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Test connection/i })).toBeInTheDocument();
  });

  it('switches create form to SAML metadata fields', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        () =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ accountId: 'acct-1', ssoFeature: true, membershipRole: 'owner' }),
          } as Response),
        () =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ providers: [] }),
          } as Response),
      ]),
    );

    render(<SsoSettingsClient />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add provider/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Add provider/i }));

    fireEvent.change(screen.getByDisplayValue('OIDC'), { target: { value: 'saml' } });
    expect(screen.getByText(/Add SAML provider/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/metadata\.xml/i)).toBeInTheDocument();
    expect(screen.queryByText(/Never paste the secret value/i)).not.toBeInTheDocument();
  });

  it('lists SAML providers with type badge', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        () =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ accountId: 'acct-1', ssoFeature: true, membershipRole: 'owner' }),
          } as Response),
        () =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ providers: [SAML_PROVIDER] }),
          } as Response),
      ]),
    );

    render(<SsoSettingsClient />);
    await waitFor(() => {
      expect(screen.getByText('Azure SAML')).toBeInTheDocument();
    });
    expect(screen.getByText('saml')).toBeInTheDocument();
  });

  it('runs test connection and shows discovery preview', async () => {
    const fetchMock = mockFetchSequence([
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ accountId: 'acct-1', ssoFeature: true, membershipRole: 'owner' }),
        } as Response),
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ providers: [] }),
        } as Response),
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            discoveryUrl: 'https://idp.example.com/.well-known/openid-configuration',
            discovery: {
              issuer: 'https://idp.example.com',
              authorizationEndpoint: 'https://idp.example.com/authorize',
              tokenEndpoint: 'https://idp.example.com/token',
              jwksUri: 'https://idp.example.com/jwks',
              scopesSupported: ['openid', 'email'],
            },
            claimStructurePreview: {
              standardClaims: ['sub', 'email'],
              groupClaim: 'groups',
              notes: ['Dry-run discovery does not issue tokens.'],
            },
          }),
        } as Response),
    ]);
    vi.stubGlobal('fetch', fetchMock);

    render(<SsoSettingsClient />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add provider/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Add provider/i }));

    fireEvent.change(screen.getByPlaceholderText('Okta Production'), {
      target: { value: 'Okta' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://your-org.okta.com'), {
      target: { value: 'https://idp.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Test connection/i }));

    await waitFor(() => {
      expect(screen.getByText(/Discovery OK/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Claim structure preview/i)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/idp\.example\.com\/jwks/)).toBeInTheDocument();
  });
});
