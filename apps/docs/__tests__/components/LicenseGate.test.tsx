/**
 * Tests for LicenseGate component
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LicenseGate } from '../../app/components/LicenseGate';

// Mock the useLicenseKey hook
const mockValidate = vi.fn();
const mockClear = vi.fn();

vi.mock('../../app/hooks/useLicenseKey', () => ({
  useLicenseKey: vi.fn(() => ({
    isValid: false,
    isLoading: false,
    validate: mockValidate,
    clear: mockClear,
    tier: null,
    key: null,
  })),
}));

// Import after mock setup so we can manipulate the return value
import { useLicenseKey } from '../../app/hooks/useLicenseKey';

const mockedUseLicenseKey = vi.mocked(useLicenseKey);

describe('LicenseGate', () => {
  it('should show loading state when license is being checked', () => {
    mockedUseLicenseKey.mockReturnValue({
      isValid: false,
      isLoading: true,
      validate: mockValidate,
      clear: mockClear,
      tier: null,
      key: null,
    });

    render(
      <LicenseGate>
        <div>Pro content</div>
      </LicenseGate>,
    );

    expect(screen.getByText('Checking license\u2026')).toBeInTheDocument();
    expect(screen.queryByText('Pro content')).not.toBeInTheDocument();
  });

  it('should show children when license is valid', () => {
    mockedUseLicenseKey.mockReturnValue({
      isValid: true,
      isLoading: false,
      validate: mockValidate,
      clear: mockClear,
      tier: 'pro',
      key: 'rlui_pro_abc',
    });

    render(
      <LicenseGate>
        <div>Pro content</div>
      </LicenseGate>,
    );

    expect(screen.getByText('Pro content')).toBeInTheDocument();
    expect(screen.getByText(/licensed/)).toBeInTheDocument();
  });

  it('should show enterprise label for enterprise tier', () => {
    mockedUseLicenseKey.mockReturnValue({
      isValid: true,
      isLoading: false,
      validate: mockValidate,
      clear: mockClear,
      tier: 'enterprise',
      key: 'rlui_ent_abc',
    });

    render(
      <LicenseGate>
        <div>Enterprise content</div>
      </LicenseGate>,
    );

    expect(screen.getByText(/Enterprise.*licensed/)).toBeInTheDocument();
  });

  it('should show license key input form when not licensed', () => {
    mockedUseLicenseKey.mockReturnValue({
      isValid: false,
      isLoading: false,
      validate: mockValidate,
      clear: mockClear,
      tier: null,
      key: null,
    });

    render(
      <LicenseGate>
        <div>Pro content</div>
      </LicenseGate>,
    );

    expect(screen.getByText('Pro docs')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('rlui_pro_...')).toBeInTheDocument();
    expect(screen.getByText('Unlock Pro docs')).toBeInTheDocument();
    expect(screen.queryByText('Pro content')).not.toBeInTheDocument();
  });

  it('should call validate when submitting a license key', async () => {
    mockedUseLicenseKey.mockReturnValue({
      isValid: false,
      isLoading: false,
      validate: mockValidate,
      clear: mockClear,
      tier: null,
      key: null,
    });

    mockValidate.mockResolvedValue({ valid: true, tier: 'pro' });

    render(
      <LicenseGate>
        <div>Pro content</div>
      </LicenseGate>,
    );

    const input = screen.getByPlaceholderText('rlui_pro_...');
    fireEvent.change(input, { target: { value: 'rlui_pro_test123' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(mockValidate).toHaveBeenCalledWith('rlui_pro_test123');
    });
  });

  it('should show error when validation fails', async () => {
    mockedUseLicenseKey.mockReturnValue({
      isValid: false,
      isLoading: false,
      validate: mockValidate,
      clear: mockClear,
      tier: null,
      key: null,
    });

    mockValidate.mockResolvedValue({ valid: false, tier: null });

    render(
      <LicenseGate>
        <div>Pro content</div>
      </LicenseGate>,
    );

    const input = screen.getByPlaceholderText('rlui_pro_...');
    fireEvent.change(input, { target: { value: 'invalid_key' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Invalid or expired license key/)).toBeInTheDocument();
    });
  });
});
