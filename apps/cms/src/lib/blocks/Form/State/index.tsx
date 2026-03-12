import type { StateField } from '@revealui/core/plugins';
import {
  SelectCVA as Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@revealui/presentation/client';
import { Controller } from 'react-hook-form';
import { FormFieldError } from '@/lib/blocks/Form/Error';
import type { ControlledFormFieldProps } from '@/lib/blocks/Form/types';
import { Width } from '@/lib/blocks/Form/Width';
import { Label } from '@/lib/components/ui/primitives/label';
import { stateOptions } from './options';

export const State = ({
  name,
  control,
  errors,
  label,
  required,
  width,
}: StateField & ControlledFormFieldProps) => {
  return (
    <Width width={width}>
      <Label htmlFor={name}>{label}</Label>
      <Controller
        control={control}
        defaultValue=""
        name={name}
        render={({ field: { onChange, value } }) => {
          const controlledValue = stateOptions.find((t) => t.value === value);

          return (
            <Select
              onValueChange={(val: string) => onChange(val)}
              value={controlledValue?.value || ''}
            >
              <SelectTrigger className="w-full" id={name}>
                <SelectValue placeholder={label} />
              </SelectTrigger>
              <SelectContent>
                {stateOptions.map(({ label, value }) => {
                  return (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          );
        }}
        rules={{ required }}
      />
      {required && errors[name] && <FormFieldError />}
    </Width>
  );
};
