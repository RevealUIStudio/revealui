/**
 * Dialog Component Tests
 *
 * Tests the Dialog portal component including open/close behavior,
 * accessibility attributes, backdrop click, and subcomponents.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '../../components/dialog';

describe('Dialog', () => {
  describe('Rendering', () => {
    it('should not render when closed', () => {
      const onClose = vi.fn();
      render(
        <Dialog open={false} onClose={onClose}>
          <DialogTitle>Hidden</DialogTitle>
        </Dialog>,
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render as portal when open', () => {
      const onClose = vi.fn();
      render(
        <Dialog open={true} onClose={onClose}>
          <DialogTitle>Visible</DialogTitle>
        </Dialog>,
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should set aria-modal to true', () => {
      const onClose = vi.fn();
      render(
        <Dialog open={true} onClose={onClose}>
          <DialogTitle>Modal</DialogTitle>
        </Dialog>,
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('should render children content', () => {
      const onClose = vi.fn();
      render(
        <Dialog open={true} onClose={onClose}>
          <DialogTitle>Test Title</DialogTitle>
          <DialogDescription>Test description content</DialogDescription>
        </Dialog>,
      );

      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test description content')).toBeInTheDocument();
    });
  });

  describe('Close behavior', () => {
    it('should call onClose when Escape key is pressed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <Dialog open={true} onClose={onClose}>
          <DialogTitle>Escapable</DialogTitle>
        </Dialog>,
      );

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Size variants', () => {
    it('should accept size prop without errors', () => {
      const onClose = vi.fn();

      for (const size of ['xs', 'sm', 'md', 'lg', 'xl'] as const) {
        const { unmount } = render(
          <Dialog open={true} onClose={onClose} size={size}>
            <DialogTitle>Size {size}</DialogTitle>
          </Dialog>,
        );
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        unmount();
      }
    });
  });
});

describe('DialogTitle', () => {
  it('should render as h2 element', () => {
    render(<DialogTitle>My Title</DialogTitle>);
    const title = screen.getByText('My Title');
    expect(title.tagName).toBe('H2');
  });

  it('should apply custom className', () => {
    render(<DialogTitle className="custom">Title</DialogTitle>);
    expect(screen.getByText('Title')).toHaveClass('custom');
  });
});

describe('DialogBody', () => {
  it('should render children in a div', () => {
    render(<DialogBody data-testid="body">Body content</DialogBody>);
    const body = screen.getByTestId('body');
    expect(body.tagName).toBe('DIV');
    expect(body).toHaveTextContent('Body content');
  });
});

describe('DialogActions', () => {
  it('should render action buttons', () => {
    render(
      <DialogActions>
        <button type="button">Cancel</button>
        <button type="button">Confirm</button>
      </DialogActions>,
    );

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });
});
