/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TextField } from '@revealui/cms/plugins'
import type React from 'react'
import type { FieldErrorsImpl, FieldValues, UseFormRegister } from 'react-hook-form'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/primitives/label'

import { Error as ErrorComponent } from '../Error'
import { Width } from '../Width'
export const NumberInput: React.FC<
  TextField & {
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
        type="number"
        {...register(name, { required: requiredFromProps })}
      />
      {requiredFromProps && errors[name] && <ErrorComponent />}
    </Width>
  )
}
