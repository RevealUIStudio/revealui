import type { EmailField } from '@revealui/core/plugins'
import type React from 'react'
import { Input } from '@/lib/components/ui/input'
import { Label } from '@/lib/components/ui/primitives/label'

import { FormFieldError } from '@/lib/blocks/Form/Error'
import type { BaseFormFieldProps } from '@/lib/blocks/Form/types'
import { Width } from '@/lib/blocks/Form/Width'

export const Email: React.FC<
  EmailField & BaseFormFieldProps & { defaultValue?: string | number }
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
  )
}
