import type React from 'react'
import { useFormContext } from 'react-hook-form'
import { Checkbox as CheckboxUi } from '../../../components/ui/checkbox'
import { Label } from '../../../components/ui/primitives/label'

import { FormFieldError } from '../Error/index'
import type { BaseFormFieldProps } from '../types'
import { Width } from '../Width/index'

interface CheckboxFieldProps extends BaseFormFieldProps {
  defaultValue?: boolean
}

export const Checkbox: React.FC<CheckboxFieldProps> = ({
  name,
  defaultValue,
  errors,
  label,
  register,
  required: requiredFromProps,
  width,
}) => {
  const props = register(name, { required: requiredFromProps })
  const { setValue } = useFormContext()

  return (
    <Width width={width}>
      <div className="flex items-center gap-2">
        <CheckboxUi
          defaultChecked={defaultValue}
          id={name}
          {...props}
          onCheckedChange={(checked: boolean) => {
            setValue(props.name, checked)
          }}
        />
        <Label htmlFor={name}>{label}</Label>
      </div>
      {requiredFromProps && errors[name] && <FormFieldError />}
    </Width>
  )
}
