// External type imports
import type { TypedFallbackLocale, PopulateType } from '../types/index'

// Request type for population
interface PopulateRequest {
  revealui?: {
    collections?: Record<string, { config?: { defaultPopulate?: unknown } }>
    config?: { collections?: unknown[] }
  }
  dataLoader?: {
    load?: (key: string) => Promise<unknown>
    find?: (options: unknown) => Promise<unknown>
  }
}

// Field types for relationship population
interface PopulateRelationshipField {
  type: 'relationship' | 'upload' | 'join'
  name: string
  relationTo?: string | string[]
  collection?: string | string[]
  hasMany?: boolean
  maxDepth?: number
  localized?: boolean
}

// Hook imports
import { afterRead } from '../fields/hooks/afterRead/index.js'

// Utility imports
import { createDataloaderCacheKey } from './dataloader.js'
import { fieldHasMaxDepth, fieldShouldBeLocalized, fieldSupportsMany } from '../fields/config/types.js'

type PopulateArgs = {
  currentDepth: number
  data: Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataReference: Record<string, any>
  depth: number
  draft: boolean
  fallbackLocale: TypedFallbackLocale
  field: PopulateRelationshipField
  index?: number
  key?: string
  locale: null | string
  overrideAccess: boolean
  populateArg?: PopulateType
  req: PopulateRequest
  showHiddenFields: boolean
}

// TODO: this function is mess, refactor logic
const populate = async ({
  currentDepth,
  data,
  dataReference,
  depth,
  draft,
  fallbackLocale,
  field,
  index,
  key,
  locale,
  overrideAccess,
  populateArg,
  req,
  showHiddenFields,
}: PopulateArgs) => {
  const dataToUpdate = dataReference
  let relation: string | undefined
  if (field.type === 'join') {
    relation = Array.isArray(field.collection) ? (data.relationTo as string) : (field.collection as string)
  } else {
    relation = Array.isArray(field.relationTo) ? (data.relationTo as string) : (field.relationTo as string)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const relatedCollection = relation && req.revealui?.collections 
    ? (req.revealui.collections as Record<string, unknown>)[relation]
    : undefined

  if (relatedCollection) {
    let id: unknown

    if (field.type === 'join' && Array.isArray(field.collection)) {
      id = data.value
    } else if (field.type !== 'join' && Array.isArray(field.relationTo)) {
      id = data.value
    } else {
      id = data
    }

    let relationshipValue
    const shouldPopulate = depth && currentDepth <= depth

    if (
      typeof id !== 'string' &&
      typeof id !== 'number' &&
      typeof (id as { toString?: () => string })?.toString === 'function' &&
      typeof id !== 'object'
    ) {
      id = (id as { toString: () => string }).toString()
    }

    if (shouldPopulate && req.dataLoader?.load) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const collectionConfig = (relatedCollection as any).config || relatedCollection
      const collectionSlug = collectionConfig?.slug || relation

      relationshipValue = await req.dataLoader.load(
        createDataloaderCacheKey({
          collectionSlug: String(collectionSlug),
          currentDepth: currentDepth + 1,
          depth,
          docID: id as string,
          draft,
          fallbackLocale: fallbackLocale!,
          locale: locale!,
          overrideAccess,
          populate: populateArg,
          select:
            populateArg && typeof populateArg === 'object' ? (populateArg as Record<string, unknown>)[String(collectionSlug)] ?? collectionConfig?.defaultPopulate : collectionConfig?.defaultPopulate,
          showHiddenFields,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          transactionID: undefined as any,
        }),
      )

      // RECURSIVE DEPTH: If we have a related document and depth allows,
      // apply afterRead to populate its relationships
      if (relationshipValue && currentDepth < depth) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sanitizedConfig: any = {
          ...collectionConfig,
          flattenedFields: collectionConfig?.fields,
          customIDType: 'text',
          trash: false,
          defaultPopulate: [],
        };

        relationshipValue = await afterRead({
          collection: sanitizedConfig,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          context: {} as any,
          currentDepth: currentDepth + 1,
          depth,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          doc: relationshipValue as any,
          draft,
          fallbackLocale: fallbackLocale!,
          findMany: false,
          flattenLocales: true,
          global: null,
          locale: locale!,
          overrideAccess,
          populate: populateArg,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          req: req as any,
          select: undefined,
          showHiddenFields,
        });
      }
    }

    if (!relationshipValue) {
      // ids are visible regardless of access controls
      relationshipValue = id
    }

    if (typeof index === 'number' && typeof key === 'string') {
      if (field.type !== 'join' && Array.isArray(field.relationTo)) {
        dataToUpdate[field.name][key][index].value = relationshipValue
      } else {
        if (field.type === 'join' && Array.isArray(field.collection)) {
          dataToUpdate[field.name][key][index].value = relationshipValue
        } else {
          dataToUpdate[field.name][key][index] = relationshipValue
        }
      }
    } else if (typeof index === 'number' || typeof key === 'string') {
      if (field.type === 'join') {
        if (!Array.isArray(field.collection)) {
          dataToUpdate[field.name].docs[index ?? key!] = relationshipValue
        } else {
          dataToUpdate[field.name].docs[index ?? key!].value = relationshipValue
        }
      } else if (Array.isArray(field.relationTo)) {
        dataToUpdate[field.name][index ?? key!].value = relationshipValue
      } else {
        dataToUpdate[field.name][index ?? key!] = relationshipValue
      }
    } else if (field.type !== 'join' && Array.isArray(field.relationTo)) {
      dataToUpdate[field.name].value = relationshipValue
    } else {
      if (field.type === 'join' && Array.isArray(field.collection)) {
        dataToUpdate[field.name].value = relationshipValue
      } else {
        dataToUpdate[field.name] = relationshipValue
      }
    }
  }
}

type PromiseArgs = {
  currentDepth: number
  depth: number
  draft: boolean
  fallbackLocale: TypedFallbackLocale
  field: PopulateRelationshipField
  locale: null | string
  overrideAccess: boolean
  populate?: PopulateType
  req: PopulateRequest
  showHiddenFields: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  siblingDoc: Record<string, any>
}

export const relationshipPopulationPromise = async ({
  currentDepth,
  depth,
  draft,
  fallbackLocale,
  field,
  locale,
  overrideAccess,
  populate: populateArg,
  req,
  showHiddenFields,
  siblingDoc,
}: PromiseArgs): Promise<void> => {
  const resultingDoc = siblingDoc
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fieldAsAny = field as any
  const populateDepth = fieldHasMaxDepth(fieldAsAny) && field.maxDepth! < depth ? field.maxDepth : depth
  const rowPromises: Promise<void>[] = []

  if (field.type === 'join' || (fieldSupportsMany(fieldAsAny) && field.hasMany)) {
    if (
      fieldShouldBeLocalized({ field: fieldAsAny, parentIsLocalized: false }) &&
      locale === 'all' &&
      typeof siblingDoc[field.name] === 'object' &&
      siblingDoc[field.name] !== null
    ) {
      Object.keys(siblingDoc[field.name]).forEach((localeKey) => {
        if (Array.isArray(siblingDoc[field.name][localeKey])) {
          siblingDoc[field.name][localeKey].forEach((_relatedDoc: any, index: number) => {
            const rowPromise = async () => {
              await populate({
                currentDepth,
                data: siblingDoc[field.name][localeKey][index],
                dataReference: resultingDoc,
                depth: populateDepth!,
                draft,
                fallbackLocale,
                field,
                index,
                key: localeKey,
                locale,
                overrideAccess,
                populateArg,
                req,
                showHiddenFields,
              })
            }
            rowPromises.push(rowPromise())
          })
        }
      })
    } else if (
      Array.isArray(siblingDoc[field.name]) ||
      Array.isArray(siblingDoc[field.name]?.docs) ||
      Array.isArray(siblingDoc[`${field.name}_ids`])
    ) {
      const relationshipArray = Array.isArray(siblingDoc[field.name])
        ? siblingDoc[field.name]
        : siblingDoc[field.name]?.docs || siblingDoc[`${field.name}_ids`];

      relationshipArray.forEach((relatedDoc: any, index: number) => {
        const rowPromise = async () => {
          if (relatedDoc) {
            await populate({
              currentDepth,
              data:
                !(field.type === 'join' && Array.isArray(field.collection)) && relatedDoc?.id
                  ? relatedDoc.id
                  : relatedDoc,
              dataReference: resultingDoc,
              depth: populateDepth!,
              draft,
              fallbackLocale,
              field,
              index,
              locale,
              overrideAccess,
              populateArg,
              req,
              showHiddenFields,
            })
          }
        }

        rowPromises.push(rowPromise())
      })
    }
  } else if (
    field.localized &&
    locale === 'all' &&
    typeof siblingDoc[field.name] === 'object' &&
    siblingDoc[field.name] !== null
  ) {
    Object.keys(siblingDoc[field.name]).forEach((localeKey) => {
      const rowPromise = async () => {
        await populate({
          currentDepth,
          data: siblingDoc[field.name][localeKey],
          dataReference: resultingDoc,
          depth: populateDepth!,
          draft,
          fallbackLocale,
          field,
          key: localeKey,
          locale,
          overrideAccess,
          populateArg,
          req,
          showHiddenFields,
        })
      }
      rowPromises.push(rowPromise())
    })

    await Promise.all(rowPromises)
  } else if (siblingDoc[field.name] || siblingDoc[`${field.name}_id`]) {
    // For relationships, the data might be in the FK column
    const relationshipData = siblingDoc[field.name] || siblingDoc[`${field.name}_id`];
    await populate({
      currentDepth,
      data: relationshipData,
      dataReference: resultingDoc,
      depth: populateDepth!,
      draft,
      fallbackLocale,
      field,
      locale,
      overrideAccess,
      populateArg,
      req,
      showHiddenFields,
    })
  }
  await Promise.all(rowPromises)
}