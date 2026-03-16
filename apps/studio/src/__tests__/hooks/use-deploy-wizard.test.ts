import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeployWizard } from '../../hooks/use-deploy-wizard';
import type { StudioConfig } from '../../types';

vi.mock('../../lib/config', () => ({
  completeStep: vi.fn().mockResolvedValue(undefined),
  isStepComplete: vi.fn().mockReturnValue(false),
}));

const { completeStep, isStepComplete } = await import('../../lib/config');

const BASE_CONFIG: StudioConfig = {
  intent: 'deploy',
  setupComplete: true,
  completedSteps: [],
};

describe('useDeployWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isStepComplete).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with 9 steps starting at step 0', () => {
    const { result } = renderHook(() => useDeployWizard(BASE_CONFIG));

    expect(result.current.steps).toHaveLength(9);
    expect(result.current.currentStep).toBe(0);
    expect(result.current.step?.id).toBe('vercel');
    expect(result.current.isFirst).toBe(true);
    expect(result.current.isLast).toBe(false);
  });

  it('navigates to next step', async () => {
    const { result } = renderHook(() => useDeployWizard(BASE_CONFIG));

    await act(async () => {
      await result.current.next();
    });

    expect(completeStep).toHaveBeenCalledWith('vercel');
    expect(result.current.currentStep).toBe(1);
    expect(result.current.step?.id).toBe('database');
    expect(result.current.isFirst).toBe(false);
  });

  it('navigates back', async () => {
    const { result } = renderHook(() => useDeployWizard(BASE_CONFIG));

    await act(async () => {
      await result.current.next();
    });

    act(() => {
      result.current.back();
    });

    expect(result.current.currentStep).toBe(0);
    expect(result.current.isFirst).toBe(true);
  });

  it('does not go back from first step', () => {
    const { result } = renderHook(() => useDeployWizard(BASE_CONFIG));

    act(() => {
      result.current.back();
    });

    expect(result.current.currentStep).toBe(0);
  });

  it('goTo navigates to specific step', () => {
    const { result } = renderHook(() => useDeployWizard(BASE_CONFIG));

    act(() => {
      result.current.goTo(4);
    });

    expect(result.current.currentStep).toBe(4);
    expect(result.current.step?.id).toBe('blob');
  });

  it('isStepDone delegates to isStepComplete', () => {
    vi.mocked(isStepComplete).mockReturnValue(true);

    const { result } = renderHook(() => useDeployWizard(BASE_CONFIG));

    expect(result.current.isStepDone('vercel')).toBe(true);
    expect(isStepComplete).toHaveBeenCalledWith(BASE_CONFIG, 'vercel');
  });

  it('isStepDone returns false when config is null', () => {
    const { result } = renderHook(() => useDeployWizard(null));

    expect(result.current.isStepDone('vercel')).toBe(false);
  });

  it('auto-resumes to first incomplete step', () => {
    vi.mocked(isStepComplete)
      .mockReturnValueOnce(true) // vercel complete
      .mockReturnValueOnce(true) // database complete
      .mockReturnValueOnce(false); // stripe incomplete

    const config: StudioConfig = {
      ...BASE_CONFIG,
      completedSteps: ['vercel', 'database'],
    };

    const { result } = renderHook(() => useDeployWizard(config));

    expect(result.current.currentStep).toBe(2);
    expect(result.current.step?.id).toBe('stripe');
  });
});
