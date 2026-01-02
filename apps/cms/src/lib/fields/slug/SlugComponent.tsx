"use client";
import React, { useCallback, useEffect } from "react";

import {
  useField,
  Button,
  TextInput,
  FieldLabel,
  useFormFields,
} from "@revealui/cms/ui";

import { formatSlug } from "./formatSlugHook";
import { TextField } from "@revealui/cms";

type SlugComponentProps = {
  fieldToUse: string;
  checkboxFieldPath: string;
} & TextFieldClientProps;

export const SlugComponent: React.FC<SlugComponentProps> = ({
  field,
  fieldToUse,
  checkboxFieldPath: checkboxFieldPathFromProps,
}) => {
  const { label } = field;
  const { path, readOnly: readOnlyFromProps } = useFieldProps(field);

  const checkboxFieldPath = path.includes(".")
    ? `${path}.${checkboxFieldPathFromProps}`
    : checkboxFieldPathFromProps;

  const { value, setValue } = useField<string>({ path });

  const { value: checkboxValue, setValue: setCheckboxValue } =
    useField<boolean>({
      path: checkboxFieldPath,
    });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fieldToUseValue = useFormFields(([fields, dispatch]) => {
    return fields[fieldToUse]?.value as string;
  });

  useEffect(() => {
    if (checkboxValue) {
      if (fieldToUseValue) {
        const formattedSlug = formatSlug(fieldToUseValue);

        if (value !== formattedSlug) setValue(formattedSlug);
      } else {
        if (value !== "") setValue("");
      }
    }
  }, [fieldToUseValue, checkboxValue, setValue, value]);

  const handleLock = useCallback(
    (e: { preventDefault: () => void }) => {
      e.preventDefault();

      setCheckboxValue(!checkboxValue);
    },
    [checkboxValue, setCheckboxValue],
  );

  const readOnly = readOnlyFromProps || checkboxValue;

  return (
    <div className="field-type slug-field-component">
      <div className="label-wrapper">
        <FieldLabel htmlFor={`field-${path}`} label={label} />

        <Button className="lock-button" buttonStyle="none" onClick={handleLock}>
          {checkboxValue ? "Unlock" : "Lock"}
        </Button>
      </div>

      <TextInput
        label={""}
        value={value}
        onChange={setValue}
        path={path}
        readOnly={readOnly}
      />
    </div>
  );
};
function useFieldProps(field: any): { path: string; readOnly: boolean } {
  // In this context, we can use the field prop that's passed to the component
  // This hook would typically be used to extract and format field properties
  // For a real implementation, you might want to use React's useContext
  // to access form context or field context
  return {
    path: field.path || '',
    readOnly: field.readOnly || false
  };
}

