import type { SelectField } from '@revealui/core/plugins'
import type React from 'react'
import { Controller } from 'react-hook-form'
import { Label } from '../../../components/ui/primitives/label'
import {
  Select as SelectComponent,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'

import { FormFieldError } from '../Error'
import type { ControlledFormFieldProps } from '../types'
import { Width } from '../Width'

export const Select: React.FC<
  SelectField &
    ControlledFormFieldProps & {
      options: Array<{ label: string; value: string }>
    }
> = ({ name, control, errors, label, options, required, width }) => {
  return (
    <Width width={width}>
      <Label htmlFor={name}>{label}</Label>
      <Controller
        control={control}
        defaultValue=""
        name={name}
        render={({ field: { onChange, value } }) => {
          const controlledValue = options.find((t) => t.value === value)

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
                  )
                })}
              </SelectContent>
            </SelectComponent>
          )
        }}
        rules={{ required }}
      />
      {required && errors[name] && <FormFieldError />}
    </Width>
  )
}
