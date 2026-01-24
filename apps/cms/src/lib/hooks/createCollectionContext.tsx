import React from 'react'
import { Slot } from '../components/ui/primitives/slot'
import { useComposedRefs } from '../components/ui/primitives/useComposedRefs'
import { createContextScope } from './createContext'

type SlotProps = React.ComponentPropsWithoutRef<typeof Slot>
type CollectionElement = HTMLElement
interface CollectionProps extends SlotProps {
  scope: string | undefined
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

  const ProviderName = `${name}CollectionProvider`
  const [createCollectionContext, createCollectionScope] = createContextScope(ProviderName)

  type ContextValue = {
    collectionRef: React.RefObject<CollectionElement | null>
    itemMap: Map<React.RefObject<ItemElement>, { ref: React.RefObject<ItemElement> } & ItemData>
  }

  const [CollectionProviderImpl, useCollectionContext] = createCollectionContext<ContextValue>(
    ProviderName,
    {
      collectionRef: { current: null },
      itemMap: new Map(),
    },
  )

  const CollectionProvider: React.FC<{
    children?: React.ReactNode
    scope: string | undefined
  }> = (props) => {
    const { scope, children } = props
    const ref = React.useRef<CollectionElement>(null)
    const itemMap = React.useRef<ContextValue['itemMap']>(new Map()).current
    return (
      <CollectionProviderImpl scope={scope} itemMap={itemMap} collectionRef={ref}>
        {children}
      </CollectionProviderImpl>
    )
  }

  CollectionProvider.displayName = ProviderName

  /* -----------------------------------------------------------------------------------------------
   * CollectionSlot
   * ---------------------------------------------------------------------------------------------*/

  const CollectionSlotName = `${name}CollectionSlot`

  const CollectionSlot = React.forwardRef<CollectionElement, CollectionProps>(
    (props, forwardedRef) => {
      const { scope, children } = props
      const context = useCollectionContext(CollectionSlotName, scope)
      const composedRefs = useComposedRefs(forwardedRef, context.collectionRef)
      return <Slot ref={composedRefs}>{children}</Slot>
    },
  )

  CollectionSlot.displayName = CollectionSlotName

  /* -----------------------------------------------------------------------------------------------
   * CollectionItem
   * ---------------------------------------------------------------------------------------------*/

  const ItemSlotName = `${name}CollectionItemSlot`
  const ItemDataAttr = 'data-radix-collection-item'

  type CollectionItemSlotProps = ItemData & {
    children: React.ReactNode
    scope: string | undefined
  }

  const CollectionItemSlot = React.forwardRef<ItemElement, CollectionItemSlotProps>(
    (props, forwardedRef) => {
      const { scope, children, ...itemData } = props
      const ref = React.useRef<ItemElement | null>(null)
      const composedRefs = useComposedRefs(forwardedRef, ref)
      const context = useCollectionContext(ItemSlotName, scope)

      React.useEffect(() => {
        // ref type is MutableRefObject but Map expects RefObject - compatible at runtime
        context.itemMap.set(ref as React.RefObject<ItemElement>, {
          ref,
          ...itemData,
        })
        return () => void context.itemMap.delete(ref as React.RefObject<ItemElement>)
      })

      return (
        <Slot {...{ [ItemDataAttr]: '' }} ref={composedRefs}>
          {children}
        </Slot>
      )
    },
  )

  CollectionItemSlot.displayName = ItemSlotName

  /* -----------------------------------------------------------------------------------------------
   * useCollection
   * ---------------------------------------------------------------------------------------------*/

  function useCollection(scope: string | undefined) {
    const context = useCollectionContext(`${name}CollectionConsumer`, scope)

    const getItems = React.useCallback(() => {
      const collectionNode = context.collectionRef.current
      if (!collectionNode) return []
      const orderedNodes = Array.from(collectionNode.querySelectorAll(`[${ItemDataAttr}]`))
      const items = Array.from(context.itemMap.values())
      const orderedItems = items.sort((a, b) => {
        // ref.current is guaranteed to exist here since items are from itemMap
        // which only contains items with valid refs
        const aRef = a.ref.current
        const bRef = b.ref.current
        if (!(aRef && bRef)) return 0
        return orderedNodes.indexOf(aRef) - orderedNodes.indexOf(bRef)
      })
      return orderedItems
    }, [context.collectionRef, context.itemMap])

    return getItems
  }

  return [
    {
      // biome-ignore lint/style/useNamingConvention: React component names require PascalCase
      Provider: CollectionProvider,
      // biome-ignore lint/style/useNamingConvention: React component names require PascalCase
      Slot: CollectionSlot,
      // biome-ignore lint/style/useNamingConvention: React component names require PascalCase
      ItemSlot: CollectionItemSlot,
    },
    useCollection,
    createCollectionScope,
  ] as const
}

export { createCollection }
export type { CollectionProps }
