import type { SelectType } from "../types/index.js";

/**
 * Gets the select configuration for a specific block
 */
export const getBlockSelect = ({
	block,
	select,
	selectMode,
}: {
	block: { slug: string };
	select: SelectType;
	selectMode: "include" | "exclude";
}): SelectType | undefined => {
	if (!select || selectMode === "exclude") return undefined;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const blockSelect = (select as any)[block.slug];
	if (typeof blockSelect === "object" && blockSelect !== null) {
		return blockSelect as SelectType;
	}

	return undefined;
};
