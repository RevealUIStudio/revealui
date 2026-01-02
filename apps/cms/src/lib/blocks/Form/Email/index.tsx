/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EmailField } from '@revealui/cms/plugins'
import type React from 'react'
import type { FieldErrorsImpl, FieldValues, UseFormRegister } from 'react-hook-form'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/primitives/label'

import { Error as ErrorComponent } from '../Error'
import { Width } from '../Width'

export const Email: React.FC<
  EmailField & {
    errors: Partial<
      FieldErrorsImpl<{
        [x: string]: any
      }>
    >
    register: UseFormRegister<FieldValues>
  }
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
        type="text"
        {...register(name, {
          pattern: /^\S[^\s@]*@\S+$/,
          required: requiredFromProps,
        })}
      />

      {requiredFromProps && errors[name] && <ErrorComponent />}
    </Width>
  )
}
