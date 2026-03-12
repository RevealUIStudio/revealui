'use client';
import type { TextField } from '@revealui/core';
import { Button, FieldLabel, TextInput, useField, useFormFields } from '@revealui/core/ui';
import type React from 'react';
import { useCallback, useEffect } from 'react';
import { formatSlug } from './formatSlugHook';

// Type for text field client props
interface TextFieldClientProps {
  field: TextField & {
    path?: string;
    readOnly?: boolean;
  };
}

type SlugComponentProps = {
  fieldToUse: string;
  checkboxFieldPath: string;
} & TextFieldClientProps;

export const SlugComponent = ({
  field,
  fieldToUse,
  checkboxFieldPath: checkboxFieldPathFromProps,
}: SlugComponentProps) => {
  const { label } = field;
  const { path, readOnly: readOnlyFromProps } = useFieldProps(field);

  const checkboxFieldPath = path.includes('.')
    ? `${path}.${checkboxFieldPathFromProps}`
    : checkboxFieldPathFromProps;

  const { value, setValue } = useField<string>({ path });

  const { value: checkboxValue, setValue: setCheckboxValue } = useField<boolean>({
    path: checkboxFieldPath,
  });

  const fieldToUseValue = useFormFields<string>(([fields]) => {
    return (fields[fieldToUse]?.value as string) || '';
  }) as string;

  useEffect(() => {
    if (checkboxValue) {
      if (fieldToUseValue) {
        const formattedSlug = formatSlug(fieldToUseValue);

        if (value !== formattedSlug) setValue(formattedSlug);
      } else {
        if (value !== '') setValue('');
      }
    }
  }, [fieldToUseValue, checkboxValue, setValue, value]);

  const handleLock = useCallback(
    (e?: React.MouseEvent<HTMLButtonElement>) => {
      e?.preventDefault();

      setCheckboxValue(!checkboxValue);
    },
    [checkboxValue, setCheckboxValue],
  );

  const readOnly = readOnlyFromProps || checkboxValue;

  return (
    <div className="field-type slug-field-component">
      <div className="label-wrapper">
        <FieldLabel htmlFor={`field-${path}`} label={typeof label === 'string' ? label : 'Slug'} />

        <Button className="lock-button" buttonStyle="none" onClick={handleLock}>
          {checkboxValue ? 'Unlock' : 'Lock'}
        </Button>
      </div>

      <TextInput
        // label={""}
        value={value}
        onChange={setValue}
        path={path}
        readOnly={readOnly}
      />
    </div>
  );
};
function useFieldProps(field: TextFieldClientProps['field']): { path: string; readOnly: boolean } {
  // In this context, we can use the field prop that's passed to the component
  // This hook would typically be used to extract and format field properties
  // For a real implementation, you might want to use React's useContext
  // to access form context or field context
  return {
    path: field.path || '',
    readOnly: Boolean(field.readOnly),
  };
}
