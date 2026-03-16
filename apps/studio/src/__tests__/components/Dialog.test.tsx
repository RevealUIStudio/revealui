import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Dialog from '../../components/ui/Dialog';

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Dialog open={false} onClose={vi.fn()} title="Test">
        Body
      </Dialog>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders when open', () => {
    render(
      <Dialog open={true} onClose={vi.fn()} title="My Dialog">
        Dialog body
      </Dialog>,
    );
    expect(screen.getByText('My Dialog')).toBeInTheDocument();
    expect(screen.getByText('Dialog body')).toBeInTheDocument();
  });

  it('renders title and description', () => {
    render(<Dialog open={true} onClose={vi.fn()} title="Confirm" description="Are you sure?" />);
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders actions', () => {
    render(
      <Dialog
        open={true}
        onClose={vi.fn()}
        title="Actions"
        actions={<button type="button">Save</button>}
      />,
    );
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <Dialog open={true} onClose={onClose} title="Closeable">
        Content
      </Dialog>,
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not render actions section when actions not provided', () => {
    const { container } = render(
      <Dialog open={true} onClose={vi.fn()} title="No Actions">
        Body
      </Dialog>,
    );
    // The actions footer has justify-end; body and header do not
    const footers = container.querySelectorAll('.justify-end');
    expect(footers.length).toBe(0);
  });
});
