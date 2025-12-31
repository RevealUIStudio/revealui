/* eslint-disable @typescript-eslint/no-explicit-any */
// Revalidate the page in the background, so the user doesn't have to wait
// Notice that the hook itself is not async and we are not awaiting `revalidate`
// Only revalidate existing docs that are published

import { revalidate } from "./revalidate";

// Don't scope to `operation` in order to purge static demo pages
export const revalidatePage = ({
	doc,
	req: { payload },
}: {
	doc: any;
	req: any;
}) => {
	if (doc._status === "published") {
		revalidate({ payload, collection: "pages", slug: doc.slug });
	}
	// Logging removed for production - use proper logging service in production
	return doc;
};
