import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusDot from '../../components/ui/StatusDot';

describe('StatusDot', () => {
  it('renders a span element', () => {
    const { container } = render(<StatusDot status="ok" />);
    expect(container.querySelector('span')).not.toBeNull();
  });

  it('applies green color for ok status', () => {
    const { container } = render(<StatusDot status="ok" />);
    expect(container.querySelector('span')?.className).toContain('bg-green-500');
  });

  it('applies yellow color for warn status', () => {
    const { container } = render(<StatusDot status="warn" />);
    expect(container.querySelector('span')?.className).toContain('bg-yellow-500');
  });

  it('applies red color for error status', () => {
    const { container } = render(<StatusDot status="error" />);
    expect(container.querySelector('span')?.className).toContain('bg-red-500');
  });

  it('applies neutral color for off status', () => {
    const { container } = render(<StatusDot status="off" />);
    expect(container.querySelector('span')?.className).toContain('bg-neutral-600');
  });

  it('defaults to sm size', () => {
    const { container } = render(<StatusDot status="ok" />);
    expect(container.querySelector('span')?.className).toContain('size-2');
  });

  it('applies md size', () => {
    const { container } = render(<StatusDot status="ok" size="md" />);
    expect(container.querySelector('span')?.className).toContain('size-2.5');
  });

  it('applies pulse animation when pulse is true', () => {
    const { container } = render(<StatusDot status="ok" pulse />);
    expect(container.querySelector('span')?.className).toContain('animate-pulse');
  });

  it('does not apply pulse animation by default', () => {
    const { container } = render(<StatusDot status="ok" />);
    expect(container.querySelector('span')?.className).not.toContain('animate-pulse');
  });

  it('has aria-hidden="true" for accessibility', () => {
    const { container } = render(<StatusDot status="ok" />);
    expect(container.querySelector('span')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies custom className', () => {
    const { container } = render(<StatusDot status="ok" className="ml-2" />);
    expect(container.querySelector('span')?.className).toContain('ml-2');
  });
});
