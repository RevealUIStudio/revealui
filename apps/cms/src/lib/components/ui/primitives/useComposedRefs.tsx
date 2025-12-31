import React from "react";
import { composeRefs } from "./composeRefs";

type PossibleRef<T> = React.Ref<T> | undefined;

function useComposedRefs<T>(...refs: PossibleRef<T>[]) {
  // Create a stable callback that doesn't change on every render
  const composedRef = React.useRef(composeRefs(...refs)); // Store the composed ref in a useRef

  React.useEffect(() => {
    composedRef.current = composeRefs(...refs); // Update the current ref whenever refs change
  }, [refs, refs.length]); // Dependency on the length of refs array to ensure it updates correctly

  return composedRef.current; // Return the current composed ref
}

export { useComposedRefs };
