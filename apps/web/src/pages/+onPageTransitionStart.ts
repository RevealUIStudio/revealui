import type { OnPageTransitionStartAsync } from "@revealui/core/types";
import { logger } from "@revealui/core/utils/logger";

export const onPageTransitionStart: OnPageTransitionStartAsync = () => {
	logger.debug("Page transition start");
	document.querySelector("body")?.classList.add("page-is-transitioning");
};
