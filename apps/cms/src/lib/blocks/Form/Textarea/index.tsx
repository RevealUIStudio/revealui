import type { TextField } from '@revealui/core/plugins'
import type React from 'react'
import { Label } from '@/lib/components/ui/primitives/label'
import { Textarea as TextAreaComponent } from '@/lib/components/ui/textarea'

import { FormFieldError } from '@/lib/blocks/Form/Error'
import type { BaseFormFieldProps } from '@/lib/blocks/Form/types'
import { Width } from '@/lib/blocks/Form/Width'

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
