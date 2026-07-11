import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the API layer so the form submit never hits the network. The component
// only depends on submitReceiptsAudit resolving to null (success) or a string
// (error message).
vi.mock('../../lib/api', () => ({
  submitReceiptsAudit: vi.fn().mockResolvedValue(null),
}));

import { submitReceiptsAudit } from '../../lib/api';
import { ReceiptsAudit } from '../receipts-audit/ReceiptsAudit';

const mockedSubmit = vi.mocked(submitReceiptsAudit);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Answer every question 'yes' by clicking each group's Yes button. */
function answerAllYes(): void {
  const yesButtons = screen.getAllByRole('button', { name: 'Yes' });
  for (const btn of yesButtons) fireEvent.click(btn);
}

describe('ReceiptsAudit', () => {
  it('renders twelve yes/no questions', () => {
    render(<ReceiptsAudit />);
    expect(screen.getAllByRole('button', { name: 'Yes' })).toHaveLength(12);
    expect(screen.getAllByRole('button', { name: 'No' })).toHaveLength(12);
  });

  it('hides the result band until every question is answered', () => {
    render(<ReceiptsAudit />);
    // Answer only the first question.
    fireEvent.click(screen.getAllByRole('button', { name: 'Yes' })[0] as HTMLElement);
    expect(screen.queryByText('Your score')).not.toBeInTheDocument();
  });

  it('reveals the score band once all twelve are answered', () => {
    render(<ReceiptsAudit />);
    answerAllYes();
    // All 'yes' scores 11 (Q5 yes is the one gap) → strong band.
    expect(screen.getByText('Your score')).toBeInTheDocument();
    expect(screen.getByText('You have receipts.')).toBeInTheDocument();
    expect(screen.getByText(/11 \/ 12/)).toBeInTheDocument();
  });

  it('submits the email against the receipts-audit source and reveals the guide', async () => {
    render(<ReceiptsAudit />);
    answerAllYes();

    // The remediation guide is hidden before submit.
    expect(screen.queryByTestId('remediation-guide')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'operator@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send it' }));

    await waitFor(() => {
      expect(screen.getByTestId('remediation-guide')).toBeInTheDocument();
    });

    expect(mockedSubmit).toHaveBeenCalledTimes(1);
    expect(mockedSubmit).toHaveBeenCalledWith({ email: 'operator@example.com', website: '' });

    // All twelve remediation items are rendered.
    const guide = screen.getByTestId('remediation-guide');
    expect(guide.querySelectorAll('li')).toHaveLength(12);
  });

  it('shows an error message when the submit fails and keeps the guide hidden', async () => {
    mockedSubmit.mockResolvedValueOnce('Signup failed: 500');
    render(<ReceiptsAudit />);
    answerAllYes();

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'operator@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send it' }));

    await waitFor(() => {
      expect(screen.getByText('Signup failed: 500')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('remediation-guide')).not.toBeInTheDocument();
  });
});
