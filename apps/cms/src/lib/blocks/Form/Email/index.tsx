import type { EmailField } from "@revealui/core/plugins";
import type React from "react";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/primitives/label";

import { Error as ErrorComponent } from "../Error";
import type { BaseFormFieldProps } from "../types";
import { Width } from "../Width";

export const Email: React.FC<
	EmailField & BaseFormFieldProps & { defaultValue?: string | number }
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
				type="email"
				{...register(name, {
					pattern: {
						value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
						message: "Invalid email format",
					},
					required: requiredFromProps,
				})}
			/>

			{requiredFromProps && errors[name] && <ErrorComponent />}
		</Width>
	);
};
