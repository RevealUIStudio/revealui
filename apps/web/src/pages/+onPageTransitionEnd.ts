import type { OnPageTransitionEndAsync } from "revealui/types";

export const onPageTransitionEnd: OnPageTransitionEndAsync = async () => {
  console.log("Page transition end");
  document.querySelector("body")?.classList.remove("page-is-transitioning");
};
