'use client';

import { useEffect, useReducer } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';

// =============================================================================
// Types
// =============================================================================

interface RefundRecord {
  id: string;
  status: string;
  amount: number;
  currency: string;
  paymentIntentId?: string;
  chargeId?: string;
  reason?: string;
  createdAt: string;
}

interface UserInfo {
  role: string;
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

interface State {
  /** Form field: Stripe payment intent or charge ID */
  identifier: string;
  /** Form field: amount in dollars (empty = full refund) */
  amountInput: string;
  /** Form field: Stripe reason enum */
  reason: 'requested_by_customer' | 'duplicate' | 'fraudulent';
  /** Submission state */
  submitStatus: SubmitStatus;
  /** Success/error message */
  message: string | null;
  /** Session-local log of issued refunds */
  history: RefundRecord[];
  /** Current user info for role check */
  user: UserInfo | null;
  /** Whether user info is still loading */
  userLoading: boolean;
}

type Action =
  | { type: 'SET_IDENTIFIER'; value: string }
  | { type: 'SET_AMOUNT'; value: string }
  | { type: 'SET_REASON'; value: State['reason'] }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; record: RefundRecord; message: string }
  | { type: 'SUBMIT_ERROR'; message: string }
  | { type: 'DISMISS_MESSAGE' }
  | { type: 'SET_USER'; user: UserInfo }
  | { type: 'SET_USER_ERROR' };

const initialState: State = {
  identifier: '',
  amountInput: '',
  reason: 'requested_by_customer',
  submitStatus: 'idle',
  message: null,
  history: [],
  user: null,
  userLoading: true,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_IDENTIFIER':
      return { ...state, identifier: action.value };
    case 'SET_AMOUNT':
      return { ...state, amountInput: action.value };
    case 'SET_REASON':
      return { ...state, reason: action.value };
    case 'SUBMIT_START':
      return { ...state, submitStatus: 'submitting', message: null };
    case 'SUBMIT_SUCCESS':
      return {
        ...state,
        submitStatus: 'success',
        message: action.message,
        history: [action.record, ...state.history],
        identifier: '',
        amountInput: '',
      };
    case 'SUBMIT_ERROR':
      return { ...state, submitStatus: 'error', message: action.message };
    case 'DISMISS_MESSAGE':
      return { ...state, submitStatus: 'idle', message: null };
    case 'SET_USER':
      return { ...state, user: action.user, userLoading: false };
    case 'SET_USER_ERROR':
      return { ...state, user: null, userLoading: false };
  }
}

// =============================================================================
// Page
// =============================================================================

export default function RefundsPage() {
  return (
    <LicenseGate feature="dashboard">
      <RefundsDashboard />
    </LicenseGate>
  );
}

function RefundsDashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { identifier, amountInput, reason, submitStatus, message, history, user, userLoading } =
    state;

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  // Fetch current user to verify admin role
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) dispatch({ type: 'SET_USER_ERROR' });
          return;
        }
        const data = (await res.json()) as { user: UserInfo };
        if (!cancelled) dispatch({ type: 'SET_USER', user: data.user });
      } catch {
        if (!cancelled) dispatch({ type: 'SET_USER_ERROR' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier.trim()) return;
    dispatch({ type: 'SUBMIT_START' });

    try {
      // Determine whether this is a payment intent or charge ID
      const isCharge = identifier.trim().startsWith('ch_');
      const body: Record<string, unknown> = {
        ...(isCharge ? { chargeId: identifier.trim() } : { paymentIntentId: identifier.trim() }),
        reason,
      };

      // Convert dollar amount to cents if provided
      if (amountInput.trim()) {
        const dollars = Number.parseFloat(amountInput.trim());
        if (Number.isNaN(dollars) || dollars <= 0) {
          dispatch({ type: 'SUBMIT_ERROR', message: 'Amount must be a positive number.' });
          return;
        }
        body.amount = Math.round(dollars * 100);
      }

      const res = await fetch(`${apiUrl}/api/billing/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        window.location.href = '/login?redirect=/admin/refunds';
        return;
      }

      const data = (await res.json()) as {
        refundId?: string;
        status?: string;
        amount?: number;
        currency?: string;
        error?: string;
      };

      if (!res.ok) {
        dispatch({
          type: 'SUBMIT_ERROR',
          message: data.error ?? `Refund failed (HTTP ${res.status})`,
        });
        return;
      }

      const record: RefundRecord = {
        id: data.refundId ?? 'unknown',
        status: data.status ?? 'pending',
        amount: data.amount ?? 0,
        currency: data.currency ?? 'usd',
        ...(isCharge ? { chargeId: identifier.trim() } : { paymentIntentId: identifier.trim() }),
        reason,
        createdAt: new Date().toISOString(),
      };

      dispatch({
        type: 'SUBMIT_SUCCESS',
        record,
        message: `Refund ${record.id} issued successfully (${formatAmount(record.amount, record.currency)})`,
      });
    } catch (err: unknown) {
      dispatch({
        type: 'SUBMIT_ERROR',
        message: err instanceof Error ? err.message : 'Network error. Please try again.',
      });
    }
  };

  // Loading state for user check
  if (userLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200"
          aria-hidden="true"
        />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-400">Authentication Required</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Please{' '}
            <a href="/login?redirect=/admin/refunds" className="text-emerald-400 underline">
              sign in
            </a>{' '}
            to access this page.
          </p>
        </div>
      </div>
    );
  }

  // Not an admin
  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-400">Access Denied</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Admin or owner role is required to issue refunds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <h1 className="text-xl font-semibold text-white">Refund Management</h1>
        <p className="mt-0.5 text-sm text-zinc-400">
          Issue full or partial refunds for Stripe payments
        </p>
      </div>

      <div className="mx-auto max-w-4xl p-6">
        {/* Refund Form */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6"
        >
          <h2 className="mb-4 text-lg font-medium text-white">Issue Refund</h2>

          {/* Status Message */}
          {message && (
            <div
              role="alert"
              className={`mb-4 flex items-center justify-between rounded-lg border p-3 text-sm ${
                submitStatus === 'success'
                  ? 'border-emerald-800 bg-emerald-900/20 text-emerald-400'
                  : 'border-red-800 bg-red-900/20 text-red-400'
              }`}
            >
              <span>{message}</span>
              <button
                type="button"
                onClick={() => dispatch({ type: 'DISMISS_MESSAGE' })}
                className="ml-3 shrink-0 text-zinc-500 hover:text-zinc-300"
                aria-label="Dismiss message"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Payment Intent / Charge ID */}
            <div className="sm:col-span-2">
              <label
                htmlFor="refund-identifier"
                className="mb-1.5 block text-sm font-medium text-zinc-300"
              >
                Payment Intent or Charge ID
              </label>
              <input
                id="refund-identifier"
                type="text"
                value={identifier}
                onChange={(e) => dispatch({ type: 'SET_IDENTIFIER', value: e.target.value })}
                placeholder="pi_abc123 or ch_abc123"
                required
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Prefix determines type: pi_ for payment intents, ch_ for charges
              </p>
            </div>

            {/* Amount */}
            <div>
              <label
                htmlFor="refund-amount"
                className="mb-1.5 block text-sm font-medium text-zinc-300"
              >
                Amount (USD)
              </label>
              <input
                id="refund-amount"
                type="number"
                value={amountInput}
                onChange={(e) => dispatch({ type: 'SET_AMOUNT', value: e.target.value })}
                placeholder="Leave empty for full refund"
                min="0.01"
                step="0.01"
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="mt-1 text-xs text-zinc-500">Optional. Omit for a full refund.</p>
            </div>

            {/* Reason */}
            <div>
              <label
                htmlFor="refund-reason"
                className="mb-1.5 block text-sm font-medium text-zinc-300"
              >
                Reason
              </label>
              <select
                id="refund-reason"
                value={reason}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_REASON',
                    value: e.target.value as State['reason'],
                  })
                }
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="requested_by_customer">Requested by customer</option>
                <option value="duplicate">Duplicate charge</option>
                <option value="fraudulent">Fraudulent</option>
              </select>
            </div>
          </div>

          {/* Submit */}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitStatus === 'submitting' || !identifier.trim()}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitStatus === 'submitting' ? (
                <span className="flex items-center gap-2">
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden="true"
                  />
                  Processing...
                </span>
              ) : (
                'Issue Refund'
              )}
            </button>
            {submitStatus === 'submitting' && (
              <span className="text-xs text-zinc-500">This may take a few seconds...</span>
            )}
          </div>
        </form>

        {/* Refund History (session-local) */}
        {history.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-lg font-medium text-white">
              Recent Refunds{' '}
              <span className="text-sm font-normal text-zinc-500">(this session)</span>
            </h2>
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="px-4 py-3 text-left font-medium text-zinc-400">Refund ID</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-400">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-400">Amount</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-400">Source</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-400">Reason</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-400">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={record.id} className="border-b border-zinc-800/50 last:border-b-0">
                      <td className="px-4 py-3 font-mono text-xs text-zinc-300">{record.id}</td>
                      <td className="px-4 py-3">
                        <RefundStatusBadge status={record.status} />
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {formatAmount(record.amount, record.currency)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                        {record.paymentIntentId ?? record.chargeId ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{formatReason(record.reason)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(record.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Help text */}
        <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <h3 className="text-sm font-medium text-zinc-300">Notes</h3>
          <ul className="mt-2 space-y-1 text-xs text-zinc-500">
            <li>
              Full refunds automatically trigger license revocation via the charge.refunded webhook.
            </li>
            <li>Partial refunds do not affect the subscription or license status.</li>
            <li>
              Refunds are idempotent per payment + admin combination to prevent duplicate
              processing.
            </li>
            <li>
              Find payment intent and charge IDs in the{' '}
              <a
                href="https://dashboard.stripe.com/payments"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 underline"
              >
                Stripe Dashboard
              </a>
              .
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Components
// =============================================================================

function RefundStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    succeeded: 'bg-emerald-500/10 text-emerald-400',
    pending: 'bg-yellow-500/10 text-yellow-400',
    failed: 'bg-red-500/10 text-red-400',
    canceled: 'bg-zinc-600/20 text-zinc-400',
    requires_action: 'bg-blue-500/10 text-blue-400',
  };
  const color = colors[status] ?? 'bg-zinc-700/20 text-zinc-400';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{status}</span>;
}

// =============================================================================
// Helpers
// =============================================================================

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatReason(reason?: string): string {
  if (!reason) return '-';
  const labels: Record<string, string> = {
    requested_by_customer: 'Customer request',
    duplicate: 'Duplicate',
    fraudulent: 'Fraudulent',
  };
  return labels[reason] ?? reason;
}
