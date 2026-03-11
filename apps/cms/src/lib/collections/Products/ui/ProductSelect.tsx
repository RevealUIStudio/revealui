'use client';

import React from 'react';

interface ProductOption {
  label: string;
  value: string;
}

const fetchStripeProducts = async (): Promise<ProductOption[]> => {
  const response = await fetch('/api/stripe/products', {
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
      (acc: ProductOption[], item: { name: string; id: string }) => {
        acc.push({
          label: item.name || item.id,
          value: item.id,
        });
        return acc;
      },
      [
        {
          label: 'Select a product',
          value: '',
        },
      ],
    );
  }
  return [];
};

export const ProductSelect = (props: {
  name: string;
  label: string;
  value?: string;
  onChange?: (value: string) => void;
}) => {
  const { name, label, value, onChange } = props;
  const [options, setOptions] = React.useState<ProductOption[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const initializeOptions = async () => {
      try {
        const fetchedOptions = await fetchStripeProducts();
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
      <p style={{ marginBottom: '0' }}>{typeof label === 'string' ? label : 'Product'}</p>
      <p
        style={{
          marginBottom: '0.75rem',
          color: 'var(--theme-elevation-400)',
        }}
      >
        {`Select the related Stripe product or `}
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
        value={value ?? ''}
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
          <option value="">Loading products...</option>
        ) : options.length === 0 ? (
          <option value="">No products found</option>
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
            href={`${stripeBaseUrl}products/${value}`}
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
