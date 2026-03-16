import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NamespaceFilter from '../../components/vault/NamespaceFilter';

describe('NamespaceFilter', () => {
  const namespaces = ['stripe', 'neon', 'supabase'];

  it('renders "Namespaces" label', () => {
    render(<NamespaceFilter namespaces={namespaces} active={null} onChange={vi.fn()} />);
    expect(screen.getByText('Namespaces')).toBeInTheDocument();
  });

  it('renders "All" button', () => {
    render(<NamespaceFilter namespaces={namespaces} active={null} onChange={vi.fn()} />);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders all namespace buttons', () => {
    render(<NamespaceFilter namespaces={namespaces} active={null} onChange={vi.fn()} />);
    for (const ns of namespaces) {
      expect(screen.getByText(ns)).toBeInTheDocument();
    }
  });

  it('calls onChange with null when All is clicked', () => {
    const onChange = vi.fn();
    render(<NamespaceFilter namespaces={namespaces} active="stripe" onChange={onChange} />);
    fireEvent.click(screen.getByText('All'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onChange with namespace when a namespace is clicked', () => {
    const onChange = vi.fn();
    render(<NamespaceFilter namespaces={namespaces} active={null} onChange={onChange} />);
    fireEvent.click(screen.getByText('stripe'));
    expect(onChange).toHaveBeenCalledWith('stripe');
  });

  it('highlights active namespace', () => {
    render(<NamespaceFilter namespaces={namespaces} active="neon" onChange={vi.fn()} />);
    const neonButton = screen.getByText('neon');
    expect(neonButton.className).toContain('bg-neutral-800');
    expect(neonButton.className).toContain('text-neutral-100');
  });

  it('highlights "All" when active is null', () => {
    render(<NamespaceFilter namespaces={namespaces} active={null} onChange={vi.fn()} />);
    const allButton = screen.getByText('All');
    expect(allButton.className).toContain('bg-neutral-800');
    expect(allButton.className).toContain('text-neutral-100');
  });

  it('shows "No namespaces" when list is empty', () => {
    render(<NamespaceFilter namespaces={[]} active={null} onChange={vi.fn()} />);
    expect(screen.getByText('No namespaces')).toBeInTheDocument();
  });
});
