/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TextField } from '@revealui/cms/plugins'
import type React from 'react'
import type { FieldErrorsImpl, FieldValues, UseFormRegister } from 'react-hook-form'
import { Label } from '../../../components/ui/primitives/label'
import { Textarea as TextAreaComponent } from '../../../components/ui/textarea'

import { Error as ErrorComponent } from '../Error'
import { Width } from '../Width'

export const Textarea: React.FC<
  TextField & {
    errors: Partial<
      FieldErrorsImpl<{
        [x: string]: any
      }>
    >
    register: UseFormRegister<FieldValues>
    rows?: number
  }
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

      {requiredFromProps && errors[name] && <ErrorComponent />}
    </Width>
  )
}
