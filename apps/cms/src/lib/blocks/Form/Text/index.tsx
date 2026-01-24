import type { TextField } from "@revealui/core/plugins";
import type React from "react";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/primitives/label";

import { Error as ErrorComponent } from "../Error";
import type { BaseFormFieldProps } from "../types";
import { Width } from "../Width";

export const Text: React.FC<
	TextField & BaseFormFieldProps & { defaultValue?: string | number }
> = ({
	name,
	defaultValue,
	errors,
	label,
	register,
	required: requiredFromProps,
	width,
}) => {
	return (
		<Width width={width}>
			<Label htmlFor={name}>{label}</Label>
			<Input
				defaultValue={
					typeof defaultValue === "string" || typeof defaultValue === "number"
						? defaultValue
						: undefined
				}
				id={name}
				type="text"
				{...register(name, { required: requiredFromProps })}
			/>
			{requiredFromProps && errors[name] && <ErrorComponent />}
		</Width>
	);
};
