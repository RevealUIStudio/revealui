import type { TextField } from '@revealui/core/plugins';
import { TextareaCVA as TextAreaComponent } from '@revealui/presentation/server';
import { FormFieldError } from '@/lib/blocks/Form/Error';
import type { BaseFormFieldProps } from '@/lib/blocks/Form/types';
import { Width } from '@/lib/blocks/Form/Width';
import { Label } from '@/lib/components/ui/primitives/label';

export const Textarea = ({
  name,
  defaultValue,
  errors,
  label,
  register,
  required: requiredFromProps,
  rows = 3,
  width,
}: TextField & BaseFormFieldProps & { defaultValue?: string | number; rows?: number }) => {
  return (
    <Width width={width}>
      <Label htmlFor={name}>{label}</Label>

      <TextAreaComponent
        defaultValue={
          typeof defaultValue === 'string' || typeof defaultValue === 'number'
            ? defaultValue
            : undefined
        }
        id={name}
        rows={rows}
        {...register(name, { required: requiredFromProps })}
      />

      {requiredFromProps && errors[name] && <FormFieldError />}
    </Width>
  );
};
