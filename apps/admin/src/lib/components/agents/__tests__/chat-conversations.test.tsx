import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/sync', () => ({
  useConversations: vi.fn(),
}));

vi.mock('@/lib/components/Agent', () => ({
  default: () => <div data-testid="agent-chat" />,
}));

vi.mock('@/lib/components/LicenseGate', () => ({
  LicenseGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/utils/csrf', () => ({
  apiFetch: vi.fn(),
}));

import { useConversations } from '@revealui/sync';

const mockUseConversations = vi.mocked(useConversations);

const defaultMutations = {
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function renderChatPage() {
  const { default: ChatPage } = await import('../../../../app/(backend)/chat/page');
  return render(<ChatPage />);
}

describe('ChatPage conversation sidebar', () => {
  it('renders loading skeletons while Electric shape is loading', async () => {
    mockUseConversations.mockReturnValue({
      conversations: [],
      isLoading: true,
      error: null,
      ...defaultMutations,
    });

    await renderChatPage();

    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders conversation list from Electric shape data', async () => {
    mockUseConversations.mockReturnValue({
      conversations: [
        {
          id: 'conv-1',
          user_id: 'user-1',
          agent_id: 'agent-1',
          title: 'First conversation',
          status: 'active',
          device_id: null,
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'conv-2',
          user_id: 'user-1',
          agent_id: 'agent-1',
          title: null,
          status: 'active',
          device_id: null,
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      isLoading: false,
      error: null,
      ...defaultMutations,
    });

    await renderChatPage();

    expect(screen.getByText('First conversation')).toBeInTheDocument();
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('shows error message when Electric shape errors', async () => {
    mockUseConversations.mockReturnValue({
      conversations: [],
      isLoading: false,
      error: new Error('Shape connection failed'),
      ...defaultMutations,
    });

    await renderChatPage();

    expect(screen.getByText('Shape connection failed')).toBeInTheDocument();
  });

  it('shows empty state when no conversations', async () => {
    mockUseConversations.mockReturnValue({
      conversations: [],
      isLoading: false,
      error: null,
      ...defaultMutations,
    });

    await renderChatPage();

    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
  });
});
