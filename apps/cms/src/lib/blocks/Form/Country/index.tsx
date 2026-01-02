/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CountryField } from "@revealui/cms/plugins";
import type { Control, FieldErrorsImpl, FieldValues } from "react-hook-form";

import React from "react";
import { Controller } from "react-hook-form";
import { Label } from "../../../components/ui/primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";

import { Error } from "../Error";
import { Width } from "../Width";
import { countryOptions } from "./options";

export const Country: React.FC<
  CountryField & {
    control: Control<FieldValues, any>;
    errors: Partial<
      FieldErrorsImpl<{
        [x: string]: any;
      }>
    >;
  }
> = ({ name, control, errors, label, required, width }) => {
  return (
    <Width width={width}>
      <Label className="" htmlFor={name}>
        {label}
      </Label>
      <Controller
        control={control}
        defaultValue=""
        name={name}
        render={({ field: { onChange, value } }) => {
          const controlledValue = countryOptions.find((t) => t.value === value);

          return (
            <Select
              onValueChange={(val: any) => onChange(val)}
              value={controlledValue?.value || ""} // Ensure a string value
            >
              <SelectTrigger className="w-full" id={name}>
                <SelectValue>
                  {controlledValue ? controlledValue.label : label}{" "}
                  {/* Conditional rendering */}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {countryOptions.map(({ label, value }) => {
                  return (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          );
        }}
        rules={{ required }}
      />
      {required && errors[name] && <Error />}
    </Width>
  );
};
