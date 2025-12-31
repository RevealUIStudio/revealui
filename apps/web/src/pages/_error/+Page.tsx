import { usePageContext } from "reveal/ui/hooks/usePageContext";

export { Page };



function Page() {
  const pageContext = usePageContext();

  let msg: string; // Message shown to the user
  const { abortReason, abortStatusCode } = pageContext as unknown as { abortReason: { notAdmin?: boolean } | string, abortStatusCode: number, is404: boolean };

  if (typeof abortReason === "object" && abortReason?.notAdmin) {
    // Handle `throw render(403, { notAdmin: true })`
    msg = "You cannot access this page because you aren't an administrator.";
  } else if (typeof abortReason === "string") {
    // Handle `throw render(abortStatusCode, `You cannot access ${someCustomMessage}`)`
    msg = abortReason;
  } else if (abortStatusCode === 403) {
    // Handle `throw render(403)`
    msg =
      "You cannot access this page because you don't have enough privileges.";
  } else if (abortStatusCode === 401) {
    // Handle `throw render(401)`
    msg =
      "You cannot access this page because you aren't logged in. Please log in.";
  } else {
    // Fallback error message
    msg = pageContext.is404
      ? "This page doesn't exist."
      : "Something went wrong. Sincere apologies. Try again (later).";
  }

  return <p>{msg}</p>;
}
