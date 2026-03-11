import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ErrorAlert from '../../components/ui/ErrorAlert';

describe('ErrorAlert', () => {
  it('renders nothing when message is null', () => {
    const { container } = render(<ErrorAlert message={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when message is undefined', () => {
    const { container } = render(<ErrorAlert message={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when message is empty string', () => {
    const { container } = render(<ErrorAlert message="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders error message', () => {
    render(<ErrorAlert message="Something went wrong" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('applies custom className', () => {
    render(<ErrorAlert message="Error" className="mt-4" />);
    expect(screen.getByRole('alert').className).toContain('mt-4');
  });
});
