/**
 * Validates if an ID is valid based on the ID type
 */
export const isValidID = (
	id: unknown,
	idType: "number" | "text" = "text",
): boolean => {
	if (idType === "number") {
		return typeof id === "number" && !Number.isNaN(id) && Number.isFinite(id);
	}

	// For text IDs, allow strings and convert numbers to strings
	if (typeof id === "number") {
		return !Number.isNaN(id) && Number.isFinite(id);
	}

	return typeof id === "string" && id.length > 0;
};
