/**
 * Alert Component Tests
 *
 * Tests for the Alert modal component including portal rendering,
 * open/close behavior, accessibility, and subcomponents.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  Alert,
  AlertActions,
  AlertBody,
  AlertDescription,
  AlertTitle,
} from '../../components/alert.js';

describe('Alert', () => {
  describe('Visibility', () => {
    it('should not render when open is false', () => {
      const onClose = vi.fn();
      render(
        <Alert open={false} onClose={onClose}>
          <AlertTitle>Hidden</AlertTitle>
        </Alert>,
      );

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('should render when open is true', () => {
      const onClose = vi.fn();
      render(
        <Alert open={true} onClose={onClose}>
          <AlertTitle>Visible</AlertTitle>
        </Alert>,
      );

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have role="alertdialog"', () => {
      const onClose = vi.fn();
      render(
        <Alert open={true} onClose={onClose}>
          <AlertTitle>Title</AlertTitle>
        </Alert>,
      );

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('should set aria-modal to true', () => {
      const onClose = vi.fn();
      render(
        <Alert open={true} onClose={onClose}>
          <AlertTitle>Modal</AlertTitle>
        </Alert>,
      );

      expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-modal', 'true');
    });
  });

  describe('Children', () => {
    it('should render AlertTitle text', () => {
      const onClose = vi.fn();
      render(
        <Alert open={true} onClose={onClose}>
          <AlertTitle>Confirm Action</AlertTitle>
        </Alert>,
      );

      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('should render AlertDescription text', () => {
      const onClose = vi.fn();
      render(
        <Alert open={true} onClose={onClose}>
          <AlertTitle>Title</AlertTitle>
          <AlertDescription>Are you sure you want to proceed?</AlertDescription>
        </Alert>,
      );

      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    });

    it('should render AlertBody content', () => {
      const onClose = vi.fn();
      render(
        <Alert open={true} onClose={onClose}>
          <AlertTitle>Title</AlertTitle>
          <AlertBody data-testid="body">Body content here</AlertBody>
        </Alert>,
      );

      expect(screen.getByTestId('body')).toHaveTextContent('Body content here');
    });

    it('should render AlertActions with buttons', () => {
      const onClose = vi.fn();
      render(
        <Alert open={true} onClose={onClose}>
          <AlertTitle>Title</AlertTitle>
          <AlertActions>
            <button type="button">Cancel</button>
            <button type="button">Confirm</button>
          </AlertActions>
        </Alert>,
      );

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });
  });

  describe('Close behavior', () => {
    it('should call onClose when Escape key is pressed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <Alert open={true} onClose={onClose}>
          <AlertTitle>Escapable</AlertTitle>
        </Alert>,
      );

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      const onClose = vi.fn();

      render(
        <Alert open={true} onClose={onClose}>
          <AlertTitle>Backdrop test</AlertTitle>
        </Alert>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Close alert' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Size variants', () => {
    it('should accept size prop without errors', () => {
      const onClose = vi.fn();

      for (const size of ['xs', 'sm', 'md', 'lg', 'xl'] as const) {
        const { unmount } = render(
          <Alert open={true} onClose={onClose} size={size}>
            <AlertTitle>Size {size}</AlertTitle>
          </Alert>,
        );
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        unmount();
      }
    });
  });
});

describe('AlertTitle', () => {
  it('should render as h2 element', () => {
    render(<AlertTitle>My Title</AlertTitle>);

    const title = screen.getByText('My Title');
    expect(title.tagName).toBe('H2');
  });

  it('should apply custom className', () => {
    render(<AlertTitle className="custom-title">Title</AlertTitle>);

    expect(screen.getByText('Title')).toHaveClass('custom-title');
  });
});

describe('AlertBody', () => {
  it('should render children in a div', () => {
    render(<AlertBody data-testid="body">Body content</AlertBody>);

    const body = screen.getByTestId('body');
    expect(body.tagName).toBe('DIV');
    expect(body).toHaveTextContent('Body content');
  });
});

describe('AlertActions', () => {
  it('should render action buttons', () => {
    render(
      <AlertActions>
        <button type="button">Cancel</button>
        <button type="button">Confirm</button>
      </AlertActions>,
    );

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });
});
