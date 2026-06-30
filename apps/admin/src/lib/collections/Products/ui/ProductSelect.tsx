'use client';

import { StripeEntitySelect } from '@/lib/collections/_shared/StripeEntitySelect';

export const ProductSelect = (props: {
  name: string;
  label: string;
  value?: string;
  onChange?: (value: string) => void;
}) => {
  const { name, label, value, onChange } = props;

  return (
    <StripeEntitySelect
      name={name}
      label={label}
      value={value}
      onChange={onChange}
      entityLabel="product"
      apiPath="/api/stripe/products"
      dashboardViewPath={`products/${value}`}
      defaultOptionLabel="Select a product"
    />
  );
};
