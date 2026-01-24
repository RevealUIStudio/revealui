import { revalidateTag } from "next/cache";

export const revalidateHeader = ({
	doc,
	req,
}: {
	doc: any;
	req: { revealui?: any };
}) => {
	const revealui = req.revealui;
	revealui?.logger?.info(`Revalidating header`);

	revalidateTag("global_header", "page");

	return doc;
};
