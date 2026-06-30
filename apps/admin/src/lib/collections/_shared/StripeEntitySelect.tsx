'use client';

import { FieldLabel, SelectInput } from '@revealui/core/ui';
import React from 'react';

interface SelectOption {
  label: string;
  value: string;
}

export interface StripeEntitySelectProps {
  name: string;
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  entityLabel: string;
  apiPath: string;
  /** Full Stripe dashboard path for the selected entity, e.g. `prices/${value}`. Only rendered when value is truthy. */
  dashboardViewPath: string;
  defaultOptionLabel: string;
}

const fetchStripeEntities = async (
  apiPath: string,
  defaultOptionLabel: string,
): Promise<SelectOption[]> => {
  const response = await fetch(apiPath, {
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
      (acc: SelectOption[], item: { name: string; id: string }) => {
        acc.push({
          label: item.name || item.id,
          value: item.id,
        });
        return acc;
      },
      [{ label: defaultOptionLabel, value: '' }],
    );
  }
  return [];
};

export const StripeEntitySelect: React.FC<StripeEntitySelectProps> = ({
  name,
  label,
  value,
  onChange,
  entityLabel,
  apiPath,
  dashboardViewPath,
  defaultOptionLabel,
}) => {
  const [options, setOptions] = React.useState<SelectOption[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const initializeOptions = async () => {
      try {
        const fetched = await fetchStripeEntities(apiPath, defaultOptionLabel);
        setOptions(fetched);
      } catch (_error) {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    initializeOptions();
  }, [apiPath, defaultOptionLabel]);

  const stripeBaseUrl = `https://dashboard.stripe.com/${
    import.meta.env.VITE_STRIPE_IS_TEST_KEY ? 'test/' : ''
  }`;

  const resolvedOptions: SelectOption[] = loading
    ? [{ label: `Loading ${entityLabel}s...`, value: '' }]
    : options.length === 0
      ? [{ label: `No ${entityLabel}s found`, value: '' }]
      : options;

  return (
    <div>
      <FieldLabel htmlFor={name} label={typeof label === 'string' ? label : entityLabel} />
      <p
        style={{
          marginBottom: '0.75rem',
          color: 'var(--theme-elevation-400)',
        }}
      >
        {`Select the related Stripe ${entityLabel} or `}
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
      <SelectInput
        path={name}
        value={value ?? ''}
        options={resolvedOptions}
        onChange={onChange}
        disabled={loading}
      />
      {value && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
          <a
            href={`${stripeBaseUrl}${dashboardViewPath}`}
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
