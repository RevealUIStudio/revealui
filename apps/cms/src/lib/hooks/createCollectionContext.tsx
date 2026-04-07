import React from 'react';
import { Slot } from '@/lib/components/ui/primitives/slot';
import { useComposedRefs } from '@/lib/components/ui/primitives/useComposedRefs';
import { createContextScope, type Scope } from './createContext';

type SlotProps = React.ComponentPropsWithoutRef<typeof Slot>;
type CollectionElement = HTMLElement;
interface CollectionProps extends SlotProps {
  scope: string | undefined;
}

// We have resorted to returning slots directly rather than exposing primitives that can then
// be slotted like `<CollectionItem as={Slot}>…</CollectionItem>`.
// This is because we encountered issues with generic types that cannot be statically analysed
// due to creating them dynamically via createCollection.

function createCollection<ItemElement extends HTMLElement, ItemData = Record<string, never>>(
  name: string,
) {
  /* -----------------------------------------------------------------------------------------------
   * CollectionProvider
   * ---------------------------------------------------------------------------------------------*/

  const ProviderName = `${name}CollectionProvider`;
  const [createCollectionContext, createCollectionScope] = createContextScope(ProviderName);

  type ContextValue = {
    collectionRef: React.RefObject<CollectionElement | null>;
    itemMap: Map<React.RefObject<ItemElement>, { ref: React.RefObject<ItemElement> } & ItemData>;
  };

  const [CollectionProviderImpl, useCollectionContext] = createCollectionContext<ContextValue>(
    ProviderName,
    {
      collectionRef: { current: null },
      itemMap: new Map(),
    },
  );

  const CollectionProvider = (props: { children?: React.ReactNode; scope: string | undefined }) => {
    const { scope, children } = props;
    const ref = React.useRef<CollectionElement>(null);
    const itemMap = React.useRef<ContextValue['itemMap']>(new Map()).current;
    return (
      <CollectionProviderImpl
        scope={scope as unknown as Scope<ContextValue>}
        itemMap={itemMap}
        collectionRef={ref}
      >
        {children}
      </CollectionProviderImpl>
    );
  };

  CollectionProvider.displayName = ProviderName;

  /* -----------------------------------------------------------------------------------------------
   * CollectionSlot
   * ---------------------------------------------------------------------------------------------*/

  const CollectionSlotName = `${name}CollectionSlot`;

  function CollectionSlot({
    scope,
    children,
    ref: forwardedRef,
  }: CollectionProps & { ref?: React.Ref<CollectionElement> }) {
    const context = useCollectionContext(
      CollectionSlotName,
      scope as Scope<ContextValue | undefined>,
    );
    const composedRefs = useComposedRefs(forwardedRef, context.collectionRef);
    return <Slot ref={composedRefs}>{children}</Slot>;
  }

  CollectionSlot.displayName = CollectionSlotName;

  /* -----------------------------------------------------------------------------------------------
   * CollectionItem
   * ---------------------------------------------------------------------------------------------*/

  const ItemSlotName = `${name}CollectionItemSlot`;
  const ItemDataAttr = 'data-radix-collection-item';

  type CollectionItemSlotProps = ItemData & {
    children: React.ReactNode;
    scope: string | undefined;
  };

  function CollectionItemSlot({
    scope,
    children,
    ref: forwardedRef,
    ...itemData
  }: CollectionItemSlotProps & { ref?: React.Ref<ItemElement> }) {
    const ref = React.useRef<ItemElement | null>(null);
    const composedRefs = useComposedRefs(forwardedRef, ref);
    const context = useCollectionContext(ItemSlotName, scope as Scope<ContextValue | undefined>);

    React.useEffect(() => {
      // ref type is MutableRefObject but Map expects RefObject - compatible at runtime
      context.itemMap.set(
        ref as React.RefObject<ItemElement>,
        {
          ref: ref as React.RefObject<ItemElement>,
          ...itemData,
        } as { ref: React.RefObject<ItemElement> } & ItemData,
      );
      return () => void context.itemMap.delete(ref as React.RefObject<ItemElement>);
    });

    return (
      <Slot {...{ [ItemDataAttr]: '' }} ref={composedRefs}>
        {children}
      </Slot>
    );
  }

  CollectionItemSlot.displayName = ItemSlotName;

  /* -----------------------------------------------------------------------------------------------
   * useCollection
   * ---------------------------------------------------------------------------------------------*/

  function useCollection(scope: string | undefined) {
    const context = useCollectionContext(
      `${name}CollectionConsumer`,
      scope as Scope<ContextValue | undefined>,
    );

    const getItems = () => {
      const collectionNode = context.collectionRef.current;
      if (!collectionNode) return [];
      const orderedNodes = Array.from(collectionNode.querySelectorAll(`[${ItemDataAttr}]`));
      const items = Array.from(context.itemMap.values());
      const orderedItems = items.sort((a, b) => {
        // ref.current is guaranteed to exist here since items are from itemMap
        // which only contains items with valid refs
        const aRef = a.ref.current;
        const bRef = b.ref.current;
        if (!(aRef && bRef)) return 0;
        return orderedNodes.indexOf(aRef) - orderedNodes.indexOf(bRef);
      });
      return orderedItems;
    };

    return getItems;
  }

  return [
    {
      Provider: CollectionProvider,
      Slot: CollectionSlot,
      ItemSlot: CollectionItemSlot,
    },
    useCollection,
    createCollectionScope,
  ] as const;
}

export type { CollectionProps };
export { createCollection };
