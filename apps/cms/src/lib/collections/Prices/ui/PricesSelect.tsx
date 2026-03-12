'use client';

import type { TextField } from '@revealui/core';
import React from 'react';

interface PriceOption {
  label: string;
  value: string;
}

const fetchStripePrices = async (): Promise<PriceOption[]> => {
  const response = await fetch('/api/stripe/prices', {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  if (data?.data) {
    return data.data.reduce(
      (acc: PriceOption[], item: { name: string; id: string }) => {
        acc.push({
          label: item.name || item.id,
          value: item.id,
        });
        return acc;
      },
      [
        {
          label: 'Select a price',
          value: '',
        },
      ],
    );
  }
  return [];
};

const PricesSelect = (props: TextField) => {
  const { name, label, value, onChange } = props as TextField & {
    value?: string;
    onChange?: (value: string) => void;
  };
  const [options, setOptions] = React.useState<PriceOption[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const initializeOptions = async () => {
      try {
        const fetchedOptions = await fetchStripePrices();
        setOptions(fetchedOptions);
      } catch (_error) {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    initializeOptions();
  }, []);

  const stripeBaseUrl = `https://dashboard.stripe.com/${
    import.meta.env.VITE_STRIPE_IS_TEST_KEY ? 'test/' : ''
  }`;

  return (
    <div>
      <p style={{ marginBottom: '0' }}>{typeof label === 'string' ? label : 'Price'}</p>
      <p
        style={{
          marginBottom: '0.75rem',
          color: 'var(--theme-elevation-400)',
        }}
      >
        {`Select the related Stripe price or `}
        <a
          href={`${stripeBaseUrl}products/create`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--theme-text)' }}
        >
          create a new one
        </a>
        {'.'}
      </p>
      <select
        name={name}
        value={(value as string) ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={loading}
        style={{
          width: '100%',
          padding: '0.5rem',
          borderRadius: '4px',
          border: '1px solid var(--theme-elevation-150)',
          background: 'var(--theme-input-bg, #fff)',
          color: 'var(--theme-text)',
          fontSize: '0.875rem',
        }}
      >
        {loading ? (
          <option value="">Loading prices...</option>
        ) : options.length === 0 ? (
          <option value="">No prices found</option>
        ) : (
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        )}
      </select>
      {value && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
          <a
            href={`${stripeBaseUrl}prices/${value}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--theme-elevation-400)' }}
          >
            View in Stripe Dashboard
          </a>
        </div>
      )}
    </div>
  );
};

export default PricesSelect;
