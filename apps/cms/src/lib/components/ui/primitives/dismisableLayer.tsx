// "use client";

// import React, {
//   useEffect,
//   useRef,
//   useState,
//   createContext,
//   useContext,
//   forwardRef,
// } from "react";
// import { Primitive } from "./primitive.js";

// const DismissableLayerContext = createContext({
//   layers: new Set<DismissableLayerElement>(),
//   branches: new Set<DismissableLayerElement>(),
// });

// // Types
// type DismissableLayerElement = React.ElementRef<typeof Primitive.div>;
// type PrimitiveDivProps = React.ComponentPropsWithoutRef<typeof Primitive.div>;

// interface DismissableLayerProps extends PrimitiveDivProps {
//   disableOutsidePointerEvents?: boolean;
//   onEscapeKeyDown?: (event: KeyboardEvent) => void;
//   onPointerDownOutside?: (event: PointerDownOutsideEvent) => void;
//   onFocusOutside?: (event: FocusOutsideEvent) => void;
//   onInteractOutside?: (
//     event: PointerDownOutsideEvent | FocusOutsideEvent,
//   ) => void;
//   onDismiss?: () => void;
// }

// const DismissableLayer = forwardRef<
//   DismissableLayerElement,
//   DismissableLayerProps
// >((props, forwardedRef) => {
//   const {
//     disableOutsidePointerEvents = false,
//     onEscapeKeyDown,
//     onPointerDownOutside,
//     onFocusOutside,
//     onInteractOutside,
//     onDismiss,
//     ...layerProps
//   } = props;

//   const context = useContext(DismissableLayerContext);
//   const [node, setNode] = useState<DismissableLayerElement | null>(null);
//   const isPointerEventsEnabled = context.layers.size === 0;

//   const pointerDownOutsideHandler = (event: PointerEvent) => {
//     if (!isPointerEventsEnabled) return;

//     onPointerDownOutside?.(event);
//     onInteractOutside?.(event);
//     if (!event.defaultPrevented) onDismiss?.();
//   };

//   const focusOutsideHandler = (event: FocusEvent) => {
//     onFocusOutside?.(event);
//     onInteractOutside?.(event);
//     if (!event.defaultPrevented) onDismiss?.();
//   };

//   const escapeKeyHandler = (event: KeyboardEvent) => {
//     onEscapeKeyDown?.(event);
//     if (!event.defaultPrevented) {
//       event.preventDefault();
//       onDismiss?.();
//     }
//   };

//   useEffect(() => {
//     if (!node) return;

//     context.layers.add(node);

//     return () => {
//       context.layers.delete(node);
//     };
//   }, [node, context]);

//   // Attach event listeners
//   useEffect(() => {
//     const handlePointerDown = (event: PointerEvent) =>
//       pointerDownOutsideHandler(event);
//     const handleFocus = (event: FocusEvent) => focusOutsideHandler(event);
//     const handleKeyDown = (event: KeyboardEvent) => escapeKeyHandler(event);

//     document.addEventListener("pointerdown", handlePointerDown);
//     document.addEventListener("focusout", handleFocus);
//     document.addEventListener("keydown", handleKeyDown);

//     return () => {
//       document.removeEventListener("pointerdown", handlePointerDown);
//       document.removeEventListener("focusout", handleFocus);
//       document.removeEventListener("keydown", handleKeyDown);
//     };
//   }, []);

//   return (
//     <Primitive.div
//       {...layerProps}
//       ref={forwardedRef}
//       style={{
//         pointerEvents:
//           disableOutsidePointerEvents && !isPointerEventsEnabled
//             ? "none"
//             : undefined,
//         ...props.style,
//       }}
//     />
//   );
// });

// DismissableLayer.displayName = "DismissableLayer";

// // DismissableLayerBranch Component
// const DismissableLayerBranch = forwardRef<
//   DismissableLayerElement,
//   PrimitiveDivProps
// >((props, forwardedRef) => {
//   const context = useContext(DismissableLayerContext);
//   const ref = useRef<DismissableLayerElement>(null);
//   const composedRefs = useRef(null);

//   useEffect(() => {
//     const node = ref.current;
//     if (node) {
//       context.branches.add(node);
//       return () => {
//         context.branches.delete(node);
//       };
//     }
//   }, [context]);

//   return <Primitive.div {...props} ref={composedRefs} />;
// });

// DismissableLayerBranch.displayName = "DismissableLayerBranch";

// // Custom event types
// type PointerDownOutsideEvent = CustomEvent<{ originalEvent: PointerEvent }>;
// type FocusOutsideEvent = CustomEvent<{ originalEvent: FocusEvent }>;

// export { DismissableLayer, DismissableLayerBranch };
// export type { DismissableLayerProps };

/* -------------------------------------------------------------------------------------------------
 * DismissableLayer
 * -----------------------------------------------------------------------------------------------*/

import React from 'react'
import { composeEventHandlers } from '@/lib/utilities/composeEventHandlers'
import { dispatchDiscreteCustomEvent, Primitive } from './primitive'
import { useCallbackRef } from './useCallbackRef'
import { useComposedRefs } from './useComposedRefs'
import { useEscapeKeydown } from './useEscapeKeydown'

const DISMISSABLE_LAYER_NAME = 'DismissableLayer'
const CONTEXT_UPDATE = 'dismissableLayer.update'
const POINTER_DOWN_OUTSIDE = 'dismissableLayer.pointerDownOutside'
const FOCUS_OUTSIDE = 'dismissableLayer.focusOutside'

let originalBodyPointerEvents: string

const DismissableLayerContext = React.createContext({
  layers: new Set<DismissableLayerElement>(),
  layersWithOutsidePointerEventsDisabled: new Set<DismissableLayerElement>(),
  branches: new Set<DismissableLayerBranchElement>(),
})

type DismissableLayerElement = React.ComponentRef<typeof Primitive.div>
type PrimitiveDivProps = React.ComponentPropsWithoutRef<typeof Primitive.div>
interface DismissableLayerProps extends PrimitiveDivProps {
  /**
   * When `true`, hover/focus/click interactions will be disabled on elements outside
   * the `DismissableLayer`. Users will need to click twice on outside elements to
   * interact with them: once to close the `DismissableLayer`, and again to trigger the element.
   */
  disableOutsidePointerEvents?: boolean
  /**
   * Event handler called when the escape key is down.
   * Can be prevented.
   */
  onEscapeKeyDown?: (event: KeyboardEvent) => void
  /**
   * Event handler called when the a `pointerdown` event happens outside of the `DismissableLayer`.
   * Can be prevented.
   */
  onPointerDownOutside?: (event: PointerDownOutsideEvent) => void
  /**
   * Event handler called when the focus moves outside of the `DismissableLayer`.
   * Can be prevented.
   */
  onFocusOutside?: (event: FocusOutsideEvent) => void
  /**
   * Event handler called when an interaction happens outside the `DismissableLayer`.
   * Specifically, when a `pointerdown` event happens outside or focus moves outside of it.
   * Can be prevented.
   */
  onInteractOutside?: (event: PointerDownOutsideEvent | FocusOutsideEvent) => void
  /**
   * Handler called when the `DismissableLayer` should be dismissed
   */
  onDismiss?: () => void
}

const DismissableLayer = React.forwardRef<DismissableLayerElement, DismissableLayerProps>(
  (props, forwardedRef) => {
    const {
      disableOutsidePointerEvents = false,
      onEscapeKeyDown,
      onPointerDownOutside,
      onFocusOutside,
      onInteractOutside,
      onDismiss,
      ...layerProps
    } = props
    const context = React.useContext(DismissableLayerContext)
    const [node, setNode] = React.useState<DismissableLayerElement | null>(null)
    const ownerDocument = node?.ownerDocument ?? globalThis?.document
    const [, force] = React.useState({})
    const composedRefs = useComposedRefs(forwardedRef, (node) => setNode(node))
    const layers = Array.from(context.layers)
    const [highestLayerWithOutsidePointerEventsDisabled] = [
      ...context.layersWithOutsidePointerEventsDisabled,
    ].slice(-1) // prettier-ignore
    const highestLayerWithOutsidePointerEventsDisabledIndex = layers.indexOf(
      highestLayerWithOutsidePointerEventsDisabled,
    ) // prettier-ignore
    const index = node ? layers.indexOf(node) : -1
    const isBodyPointerEventsDisabled = context.layersWithOutsidePointerEventsDisabled.size > 0
    const isPointerEventsEnabled = index >= highestLayerWithOutsidePointerEventsDisabledIndex

    const pointerDownOutside = usePointerDownOutside((event) => {
      const target = event.target as HTMLElement
      const isPointerDownOnBranch = [...context.branches].some((branch) => branch.contains(target))
      if (!isPointerEventsEnabled || isPointerDownOnBranch) return
      onPointerDownOutside?.(event)
      onInteractOutside?.(event)
      if (!event.defaultPrevented) onDismiss?.()
    }, ownerDocument)

    const focusOutside = useFocusOutside((event) => {
      const target = event.target as HTMLElement
      const isFocusInBranch = [...context.branches].some((branch) => branch.contains(target))
      if (isFocusInBranch) return
      onFocusOutside?.(event)
      onInteractOutside?.(event)
      if (!event.defaultPrevented) onDismiss?.()
    }, ownerDocument)

    useEscapeKeydown((event) => {
      const isHighestLayer = index === context.layers.size - 1
      if (!isHighestLayer) return
      onEscapeKeyDown?.(event)
      if (!event.defaultPrevented && onDismiss) {
        event.preventDefault()
        onDismiss()
      }
    }, ownerDocument)

    React.useEffect(() => {
      if (!node) return
      if (disableOutsidePointerEvents) {
        if (context.layersWithOutsidePointerEventsDisabled.size === 0) {
          originalBodyPointerEvents = ownerDocument.body.style.pointerEvents
          ownerDocument.body.style.pointerEvents = 'none'
        }
        context.layersWithOutsidePointerEventsDisabled.add(node)
      }
      context.layers.add(node)
      dispatchUpdate()
      return () => {
        if (
          disableOutsidePointerEvents &&
          context.layersWithOutsidePointerEventsDisabled.size === 1
        ) {
          ownerDocument.body.style.pointerEvents = originalBodyPointerEvents
        }
      }
    }, [node, ownerDocument, disableOutsidePointerEvents, context])

    /**
     * We purposefully prevent combining this effect with the `disableOutsidePointerEvents` effect
     * because a change to `disableOutsidePointerEvents` would remove this layer from the stack
     * and add it to the end again so the layering order wouldn't be _creation order_.
     * We only want them to be removed from context stacks when unmounted.
     */
    React.useEffect(() => {
      return () => {
        if (!node) return
        context.layers.delete(node)
        context.layersWithOutsidePointerEventsDisabled.delete(node)
        dispatchUpdate()
      }
    }, [node, context])

    React.useEffect(() => {
      const handleUpdate = () => force({})
      document.addEventListener(CONTEXT_UPDATE, handleUpdate)
      return () => document.removeEventListener(CONTEXT_UPDATE, handleUpdate)
    }, [])

    return (
      <Primitive.div
        {...layerProps}
        ref={composedRefs}
        style={{
          pointerEvents: isBodyPointerEventsDisabled
            ? isPointerEventsEnabled
              ? 'auto'
              : 'none'
            : undefined,
          ...props.style,
        }}
        onFocusCapture={composeEventHandlers(props.onFocusCapture, focusOutside.onFocusCapture)}
        onBlurCapture={composeEventHandlers(props.onBlurCapture, focusOutside.onBlurCapture)}
        onPointerDownCapture={composeEventHandlers(
          props.onPointerDownCapture,
          pointerDownOutside.onPointerDownCapture,
        )}
      />
    )
  },
)

DismissableLayer.displayName = DISMISSABLE_LAYER_NAME

/* -------------------------------------------------------------------------------------------------
 * DismissableLayerBranch
 * -----------------------------------------------------------------------------------------------*/

const BRANCH_NAME = 'DismissableLayerBranch'

type DismissableLayerBranchElement = React.ElementRef<typeof Primitive.div>
interface DismissableLayerBranchProps extends PrimitiveDivProps {}

const DismissableLayerBranch = React.forwardRef<
  DismissableLayerBranchElement,
  DismissableLayerBranchProps
>((props, forwardedRef) => {
  const context = React.useContext(DismissableLayerContext)
  const ref = React.useRef<DismissableLayerBranchElement>(null)
  const composedRefs = useComposedRefs(forwardedRef, ref)

  React.useEffect(() => {
    const node = ref.current
    if (node) {
      context.branches.add(node)
      return () => {
        context.branches.delete(node)
      }
    }
  }, [context.branches])

  return <Primitive.div {...props} ref={composedRefs} />
})

DismissableLayerBranch.displayName = BRANCH_NAME

/* -----------------------------------------------------------------------------------------------*/

type PointerDownOutsideEvent = CustomEvent<{ originalEvent: PointerEvent }>
type FocusOutsideEvent = CustomEvent<{ originalEvent: FocusEvent }>

/**
 * Listens for `pointerdown` outside a react subtree. We use `pointerdown` rather than `pointerup`
 * to mimic layer dismissing behaviour present in OS.
 * Returns props to pass to the node we want to check for outside events.
 */
function usePointerDownOutside(
  onPointerDownOutside?: (event: PointerDownOutsideEvent) => void,
  ownerDocument: Document = globalThis?.document,
) {
  const handlePointerDownOutside = useCallbackRef(onPointerDownOutside) as EventListener
  const isPointerInsideReactTreeRef = React.useRef(false)
  const handleClickRef = React.useRef<() => void>(() => undefined)

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target && !isPointerInsideReactTreeRef.current) {
        const eventDetail = { originalEvent: event }

        // eslint-disable-next-line no-inner-declarations
        function handleAndDispatchPointerDownOutsideEvent() {
          handleAndDispatchCustomEvent(
            POINTER_DOWN_OUTSIDE,
            handlePointerDownOutside,
            eventDetail,
            { discrete: true },
          )
        }

        /**
         * On touch devices, we need to wait for a click event because browsers implement
         * a ~350ms delay between the time the user stops touching the display and when the
         * browser executres events. We need to ensure we don't reactivate pointer-events within
         * this timeframe otherwise the browser may execute events that should have been prevented.
         *
         * Additionally, this also lets us deal automatically with cancellations when a click event
         * isn't raised because the page was considered scrolled/drag-scrolled, long-pressed, etc.
         *
         * This is why we also continuously remove the previous listener, because we cannot be
         * certain that it was raised, and therefore cleaned-up.
         */
        if (event.pointerType === 'touch') {
          ownerDocument.removeEventListener('click', handleClickRef.current)
          handleClickRef.current = handleAndDispatchPointerDownOutsideEvent
          ownerDocument.addEventListener('click', handleClickRef.current, {
            once: true,
          })
        } else {
          handleAndDispatchPointerDownOutsideEvent()
        }
      } else {
        // We need to remove the event listener in case the outside click has been canceled.
        // See: https://github.com/radix-ui/primitives/issues/2171
        ownerDocument.removeEventListener('click', handleClickRef.current)
      }
      isPointerInsideReactTreeRef.current = false
    }
    /**
     * if this hook executes in a component that mounts via a `pointerdown` event, the event
     * would bubble up to the document and trigger a `pointerDownOutside` event. We avoid
     * this by delaying the event listener registration on the document.
     * This is not React specific, but rather how the DOM works, ie:
     * ```
     * button.addEventListener('pointerdown', () => {
     *   console.log('I will log');
     *   document.addEventListener('pointerdown', () => {
     *     console.log('I will also log');
     *   })
     * });
     */
    const timerId = window.setTimeout(() => {
      ownerDocument.addEventListener('pointerdown', handlePointerDown)
    }, 0)
    return () => {
      window.clearTimeout(timerId)
      ownerDocument.removeEventListener('pointerdown', handlePointerDown)
      ownerDocument.removeEventListener('click', handleClickRef.current)
    }
  }, [ownerDocument, handlePointerDownOutside])

  return {
    // ensures we check React component tree (not just DOM tree)
    onPointerDownCapture: () => {
      isPointerInsideReactTreeRef.current = true
    },
  }
}

/**
 * Listens for when focus happens outside a react subtree.
 * Returns props to pass to the root (node) of the subtree we want to check.
 */
function useFocusOutside(
  onFocusOutside?: (event: FocusOutsideEvent) => void,
  ownerDocument: Document = globalThis?.document,
) {
  const handleFocusOutside = useCallbackRef(onFocusOutside) as EventListener
  const isFocusInsideReactTreeRef = React.useRef(false)

  React.useEffect(() => {
    const handleFocus = (event: FocusEvent) => {
      if (event.target && !isFocusInsideReactTreeRef.current) {
        const eventDetail = { originalEvent: event }
        handleAndDispatchCustomEvent(FOCUS_OUTSIDE, handleFocusOutside, eventDetail, {
          discrete: false,
        })
      }
    }
    ownerDocument.addEventListener('focusin', handleFocus)
    return () => ownerDocument.removeEventListener('focusin', handleFocus)
  }, [ownerDocument, handleFocusOutside])

  return {
    onFocusCapture: () => {
      isFocusInsideReactTreeRef.current = true
    },
    onBlurCapture: () => {
      isFocusInsideReactTreeRef.current = false
    },
  }
}

function dispatchUpdate() {
  const event = new CustomEvent(CONTEXT_UPDATE)
  document.dispatchEvent(event)
}

function handleAndDispatchCustomEvent<E extends CustomEvent, OriginalEvent extends Event>(
  name: string,
  handler: ((event: E) => void) | undefined,
  detail: { originalEvent: OriginalEvent } & (E extends CustomEvent<infer D> ? D : never),
  { discrete }: { discrete: boolean },
) {
  const target = detail.originalEvent.target
  const event = new CustomEvent(name, {
    bubbles: false,
    cancelable: true,
    detail,
  })
  if (handler) target.addEventListener(name, handler as EventListener, { once: true })

  if (discrete) {
    dispatchDiscreteCustomEvent(target, event)
  } else {
    target.dispatchEvent(event)
  }
}

const Root = DismissableLayer
const Branch = DismissableLayerBranch

export {
  DismissableLayer,
  DismissableLayerBranch,
  //
  Root,
  Branch,
}
export type { DismissableLayerProps }
