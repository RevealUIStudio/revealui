import { setRef } from './setRef';

type PossibleRef<T> = React.Ref<T> | undefined;
function composeRefs<T>(...refs: PossibleRef<T>[]) {
  return (node: T) => {
    refs.forEach((ref) => {
      setRef(ref, node);
    });
  };
}

export { composeRefs };
