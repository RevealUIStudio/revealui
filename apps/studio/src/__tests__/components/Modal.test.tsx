import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Modal from '../../components/ui/Modal';

describe('Modal', () => {
  const defaultProps = {
    title: 'Test Modal',
    open: true,
    onClose: vi.fn(),
    children: <p>Modal content</p>,
  };

  it('renders when open is true', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<Modal {...defaultProps} open={false} />);
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders footer when provided', () => {
    render(
      <Modal {...defaultProps} footer={<button type="button">Save</button>}>
        Content
      </Modal>,
    );
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('does not render footer section when not provided', () => {
    const { container } = render(<Modal {...defaultProps} />);
    // Without a footer prop, no footer border-t section should render
    // The header uses border-b, footer uses border-t
    const footerDivs = container.querySelectorAll('.border-t.border-neutral-800');
    expect(footerDivs.length).toBe(0);
  });

  it('applies sm maxWidth', () => {
    const { container } = render(<Modal {...defaultProps} maxWidth="sm" />);
    const dialog = container.querySelector('.max-w-sm');
    expect(dialog).not.toBeNull();
  });

  it('applies md maxWidth by default', () => {
    const { container } = render(<Modal {...defaultProps} />);
    const dialog = container.querySelector('.max-w-md');
    expect(dialog).not.toBeNull();
  });

  it('applies lg maxWidth', () => {
    const { container } = render(<Modal {...defaultProps} maxWidth="lg" />);
    const dialog = container.querySelector('.max-w-lg');
    expect(dialog).not.toBeNull();
  });
});
