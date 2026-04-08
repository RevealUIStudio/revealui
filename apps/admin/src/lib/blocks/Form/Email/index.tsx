import type { EmailField } from '@revealui/core/plugins';
import { InputCVA as Input } from '@revealui/presentation/server';
import { FormFieldError } from '@/lib/blocks/Form/Error';
import type { BaseFormFieldProps } from '@/lib/blocks/Form/types';
import { Width } from '@/lib/blocks/Form/Width';
import { Label } from '@/lib/components/ui/primitives/label';

export const Email = ({
  name,
  defaultValue,
  errors,
  label,
  register,
  required: requiredFromProps,
  width,
}: EmailField & BaseFormFieldProps & { defaultValue?: string | number }) => {
  return (
    <Width width={width}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        defaultValue={
          typeof defaultValue === 'string' || typeof defaultValue === 'number'
            ? defaultValue
            : undefined
        }
        id={name}
        type="email"
        {...register(name, {
          pattern: {
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Invalid email format',
          },
          required: requiredFromProps,
        })}
      />

      {requiredFromProps && errors[name] && <FormFieldError />}
    </Width>
  );
};
