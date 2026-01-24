export const formatSlug = (val: string): string =>
	val
		.replace(/ /g, "-")
		.replace(/[^\w-]+/g, "")
		.toLowerCase();

export const formatSlugHook =
	(fallback: string) =>
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	({
		data,
		operation,
		originalDoc,
		value,
	}: {
		data?: any;
		operation?: string;
		originalDoc?: any;
		value?: any;
	}) => {
		if (typeof value === "string") {
			return formatSlug(value);
		}

		if (operation === "create" || !data?.slug) {
			const fallbackData =
				data?.[fallback] || data?.[fallback] || originalDoc?.[fallback];

			if (fallbackData && typeof fallbackData === "string") {
				return formatSlug(fallbackData);
			}
		}

		return value;
	};
