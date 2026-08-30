import type { Page } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';
import { AdminPage } from '../e2e/page-objects/AdminPage.js';

function mockPage(): { page: Page; goto: ReturnType<typeof vi.fn> } {
  const goto = vi.fn().mockResolvedValue(undefined);
  const page = {
    goto,
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    waitForURL: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue('http://localhost:4000/'),
  } as unknown as Page;
  return { page, goto };
}

describe('AdminPage.navigateTo', () => {
  it('calls page.goto on the admin origin instead of recursing', async () => {
    const { page, goto } = mockPage();
    const admin = new AdminPage(page);
    await admin.navigateTo('http://localhost:4000');
    expect(goto).toHaveBeenCalledTimes(1);
    const url = String(goto.mock.calls[0]?.[0]);
    expect(url.startsWith('http://localhost:4000')).toBe(true);
    expect(url.includes(':3000')).toBe(false);
  });
});
