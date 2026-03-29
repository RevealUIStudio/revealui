import React from 'react';

type PossibleRef<T> = React.Ref<T> | undefined;

function setRef<T>(ref: PossibleRef<T>, value: T) {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref && 'current' in ref) {
    (ref as React.MutableRefObject<T>).current = value;
  }
}

function composeRefs<T>(...refs: PossibleRef<T>[]) {
  return (node: T) => {
    for (const ref of refs) {
      setRef(ref, node);
    }
  };
}

function useComposedRefs<T>(...refs: PossibleRef<T>[]) {
  const composedRef = React.useRef(composeRefs(...refs));

  React.useEffect(() => {
    composedRef.current = composeRefs(...refs);
  }, [refs, refs.length]);

  return composedRef.current;
}

export { useComposedRefs };
