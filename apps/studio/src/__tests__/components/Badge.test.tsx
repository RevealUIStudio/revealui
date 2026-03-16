import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Badge from '../../components/ui/Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge.className).toContain('bg-neutral-800');
    expect(badge.className).toContain('text-neutral-300');
  });

  it('applies success variant styles', () => {
    render(<Badge variant="success">OK</Badge>);
    const badge = screen.getByText('OK');
    expect(badge.className).toContain('text-green-400');
  });

  it('applies warning variant styles', () => {
    render(<Badge variant="warning">Warn</Badge>);
    const badge = screen.getByText('Warn');
    expect(badge.className).toContain('text-yellow-400');
  });

  it('applies error variant styles', () => {
    render(<Badge variant="error">Fail</Badge>);
    const badge = screen.getByText('Fail');
    expect(badge.className).toContain('text-red-400');
  });

  it('applies info variant styles', () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge.className).toContain('text-blue-400');
  });

  it('applies brand variant styles', () => {
    render(<Badge variant="brand">Pro</Badge>);
    const badge = screen.getByText('Pro');
    expect(badge.className).toContain('text-orange-400');
  });

  it('applies sm size styles', () => {
    render(<Badge size="sm">Small</Badge>);
    const badge = screen.getByText('Small');
    expect(badge.className).toContain('px-1.5');
  });

  it('applies md size styles by default', () => {
    render(<Badge>Medium</Badge>);
    const badge = screen.getByText('Medium');
    expect(badge.className).toContain('px-2');
  });

  it('applies custom className', () => {
    render(<Badge className="ml-2">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge.className).toContain('ml-2');
  });
});
