import type { CountryField } from '@revealui/core/plugins';
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
import { countryOptions } from './options';

export const Country = ({
  name,
  control,
  errors,
  label,
  required,
  width,
}: CountryField & ControlledFormFieldProps) => {
  return (
    <Width width={width}>
      <Label className="" htmlFor={name}>
        {label}
      </Label>
      <Controller
        control={control}
        defaultValue=""
        name={name}
        render={({ field: { onChange, value } }) => {
          const controlledValue = countryOptions.find((t) => t.value === value);

          return (
            <Select
              onValueChange={(val: string) => onChange(val)}
              value={controlledValue?.value || ''}
            >
              <SelectTrigger className="w-full" id={name}>
                <SelectValue>
                  {controlledValue ? controlledValue.label : label} {/* Conditional rendering */}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {countryOptions.map(({ label, value }) => {
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
