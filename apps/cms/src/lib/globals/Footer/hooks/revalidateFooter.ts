import { revalidateTag } from "next/cache";

export const revalidateFooter = ({
	doc,
	req,
}: {
	doc: any;
	req: { revealui?: any };
}) => {
	const revealui = req.revealui;
	revealui?.logger?.info(`Revalidating footer`);

	revalidateTag("global_footer", "page");

	return doc;
};
