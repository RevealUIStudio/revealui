import type { SelectField } from '@revealui/core/plugins';
import {
  SelectCVA as SelectComponent,
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

export const Select = ({
  name,
  control,
  errors,
  label,
  options,
  required,
  width,
}: SelectField &
  ControlledFormFieldProps & {
    options: Array<{ label: string; value: string }>;
  }) => {
  return (
    <Width width={width}>
      <Label htmlFor={name}>{label}</Label>
      <Controller
        control={control}
        defaultValue=""
        name={name}
        render={({ field: { onChange, value } }) => {
          const controlledValue = options.find((t) => t.value === value);

          return (
            <SelectComponent
              onValueChange={(val: string) => onChange(val)}
              value={controlledValue?.value || ''}
            >
              <SelectTrigger className="w-full" id={name}>
                <SelectValue placeholder={label} />
              </SelectTrigger>
              <SelectContent>
                {options.map(({ label: optionLabel, value: optionValue }) => {
                  return (
                    <SelectItem key={optionValue} value={optionValue}>
                      {optionLabel}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </SelectComponent>
          );
        }}
        rules={{ required }}
      />
      {required && errors[name] && <FormFieldError />}
    </Width>
  );
};
