/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  FieldErrorsImpl,
  FieldValues,
  UseFormRegister,
} from "react-hook-form";

import { useFormContext } from "react-hook-form";

import React from "react";
import { Checkbox as CheckboxUi } from "../../../components/ui/checkbox";
import { Label } from "../../../components/ui/primitives/label";

import { Error } from "../Error";
import { Width } from "../Width";

interface CheckboxFieldProps {
  name: string;
  defaultValue?: boolean;
  label?: string;
  required?: boolean;
  width?: string | number;
}

export const Checkbox: React.FC<
  CheckboxFieldProps & {
    errors: Partial<
      FieldErrorsImpl<{
        [x: string]: any;
      }>
    >;
    getValues: any;
    register: UseFormRegister<FieldValues>;
    setValue: any;
  }
> = ({
  name,
  defaultValue,
  errors,
  label,
  register,
  required: requiredFromProps,
  width,
}) => {
  const props = register(name, { required: requiredFromProps });
  const { setValue } = useFormContext();

  return (
    <Width width={width}>
      <div className="flex items-center gap-2">
        <CheckboxUi
          defaultChecked={defaultValue}
          id={name}
          {...props}
          onCheckedChange={(checked: any) => {
            setValue(props.name, checked);
          }}
        />
        <Label htmlFor={name}>{label}</Label>
      </div>
      {requiredFromProps && errors[name as keyof typeof errors] && <Error />}
    </Width>
  );
};
