import type { TextField } from '@revealui/core/plugins'
import type React from 'react'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/primitives/label'

import { FormFieldError } from '../Error/index'
import type { BaseFormFieldProps } from '../types'
import { Width } from '../Width/index'

export const NumberInput: React.FC<
  TextField & BaseFormFieldProps & { defaultValue?: string | number }
> = ({ name, defaultValue, errors, label, register, required: requiredFromProps, width }) => {
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
        type="number"
        {...register(name, { required: requiredFromProps })}
      />
      {requiredFromProps && errors[name] && <FormFieldError />}
    </Width>
  )
}
