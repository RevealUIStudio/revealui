import type { TextField } from '@revealui/core/plugins'
import type React from 'react'
import { Label } from '../../../components/ui/primitives/label.js'
import { Textarea as TextAreaComponent } from '../../../components/ui/textarea.js'

import { FormFieldError } from '../Error/index.js'
import type { BaseFormFieldProps } from '../types.js'
import { Width } from '../Width/index.js'

export const Textarea: React.FC<
  TextField & BaseFormFieldProps & { defaultValue?: string | number; rows?: number }
> = ({
  name,
  defaultValue,
  errors,
  label,
  register,
  required: requiredFromProps,
  rows = 3,
  width,
}) => {
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
  )
}
