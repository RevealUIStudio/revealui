import type { TextField } from '@revealui/core';
import { logger } from '@revealui/utils/logger';
import React from 'react';

const fetchStripeCustomers = async () => {
  const response = await fetch(`/api/stripe/customers`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

const CustomerSelect = (props: TextField) => {
  const { name, label } = props;
  const [options, setOptions] = React.useState<
    {
      label: string;
      value: string;
    }[]
  >([]);
  const optionsMap = options.map((option) => <p key={option.value}>{option.label}</p>);
  React.useEffect(() => {
    const initializeOptions = async () => {
      try {
        const res = await fetchStripeCustomers();
        if (res?.data && Array.isArray(res.data)) {
          const fetchedCustomers = res.data.reduce(
            (
              acc: { label: string; value: string }[],
              item: { name: string; email: string; id: string },
            ) => {
              acc.push({
                label: item.name || item.email || item.id,
                value: item.id,
              });
              return acc;
            },
            [{ label: 'Select a customer', value: '' }],
          );
          setOptions(fetchedCustomers);
        }
      } catch (error) {
        logger.error('Error fetching customers', { error });
      }
    };

    initializeOptions();
  }, []);

  return (
    <>
      <h1>Hello, {name} </h1>
      <p style={{ marginBottom: '0' }}>{typeof label === 'string' ? label : 'Customer'}</p>

      <div>
        <h1>CustomerSelect</h1>
        <p>{name}</p>
        <p style={{ marginBottom: '0' }}>{typeof label === 'string' ? label : 'Customer'}</p>
        <p
          style={{
            marginBottom: '0.75rem',
            color: 'var(--theme-elevation-400)',
          }}
        >
          {`Select the related Stripe customer or `}
          <a
            href={`https://dashboard.stripe.com/${process.env.VITE_STRIPE_IS_TEST_KEY ? 'test/' : ''}customers/create`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--theme-text)' }}
          >
            create a new one
          </a>
          {'.'}
        </p>
        <p>{optionsMap}</p>
      </div>
    </>
  );
};

export default CustomerSelect;
