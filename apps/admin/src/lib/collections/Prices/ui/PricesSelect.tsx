'use client';

import type { TextField } from '@revealui/core';
import { StripeEntitySelect } from '@/lib/collections/_shared/StripeEntitySelect';

const PricesSelect = (props: TextField) => {
  const { name, label, value, onChange } = props as TextField & {
    value?: string;
    onChange?: (value: string) => void;
  };

  return (
    <StripeEntitySelect
      name={name}
      label={typeof label === 'string' ? label : 'Price'}
      value={value}
      onChange={onChange}
      entityLabel="price"
      apiPath="/api/stripe/prices"
      dashboardViewPath={`prices/${value}`}
      defaultOptionLabel="Select a price"
    />
  );
};

export default PricesSelect;
