import { CheckboxCVA as CheckboxUi } from '@revealui/presentation/client';
import { useFormContext } from 'react-hook-form';
import { FormFieldError } from '@/lib/blocks/Form/Error';
import type { BaseFormFieldProps } from '@/lib/blocks/Form/types';
import { Width } from '@/lib/blocks/Form/Width';
import { Label } from '@/lib/components/ui/primitives/label';

interface CheckboxFieldProps extends BaseFormFieldProps {
  defaultValue?: boolean;
}

export const Checkbox = ({
  name,
  defaultValue,
  errors,
  label,
  register,
  required: requiredFromProps,
  width,
}: CheckboxFieldProps) => {
  const props = register(name, { required: requiredFromProps });
  const { setValue } = useFormContext();

  return (
    <Width width={width}>
      <div className="flex items-center gap-2">
        <CheckboxUi
          defaultChecked={defaultValue}
          id={name}
          {...props}
          onCheckedChange={(checked: boolean) => {
            setValue(props.name, checked);
          }}
        />
        <Label htmlFor={name}>{label}</Label>
      </div>
      {requiredFromProps && errors[name] && <FormFieldError />}
    </Width>
  );
};
