// External type imports
import type {
  JsonObject,
  PopulateType,
  RequestContext,
  RevealRequest,
  SanitizedCollectionConfig,
  SelectType,
  TypedFallbackLocale,
} from '../types/index.js'

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

// Utility imports
import { createDataloaderCacheKey } from '../dataloader.js'
import {
  type Field,
  fieldHasMaxDepth,
  fieldShouldBeLocalized,
  fieldSupportsMany,
} from '../fields/config/types.js'
// Hook imports
import { afterRead } from '../fields/hooks/afterRead/index.js'

type PopulateArgs = {
  currentDepth: number
  data: unknown
  dataReference: Record<string, unknown>
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
  const dataRecord = data as Record<string, unknown>
  let relation: string | undefined
  if (field.type === 'join') {
    relation = Array.isArray(field.collection)
      ? (dataRecord.relationTo as string)
      : (field.collection as string)
  } else {
    relation = Array.isArray(field.relationTo)
      ? (dataRecord.relationTo as string)
      : (field.relationTo as string)
  }

  const relatedCollection =
    relation && req.revealui?.collections
      ? (req.revealui.collections as Record<string, unknown>)[relation]
      : undefined

  if (relatedCollection) {
    let id: unknown

    if (field.type === 'join' && Array.isArray(field.collection)) {
      id = dataRecord.value
    } else if (field.type !== 'join' && Array.isArray(field.relationTo)) {
      id = dataRecord.value
    } else {
      id = data
    }

    let relationshipValue: unknown
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
      const collectionConfig: {
        slug?: string
        fields?: unknown[]
        defaultPopulate?: unknown
      } =
        (
          relatedCollection as {
            config?: {
              slug?: string
              fields?: unknown[]
              defaultPopulate?: unknown
            }
          }
        ).config || relatedCollection
      const collectionSlug = collectionConfig?.slug || relation

      relationshipValue = await req.dataLoader.load(
        createDataloaderCacheKey({
          collectionSlug: String(collectionSlug),
          currentDepth: currentDepth + 1,
          depth,
          docID: id as string,
          draft,
          fallbackLocale,
          locale: locale || 'en',
          overrideAccess,
          populate: populateArg || undefined,
          select:
            populateArg && typeof populateArg === 'object'
              ? (((populateArg as Record<string, unknown>)[String(collectionSlug)] ??
                  collectionConfig?.defaultPopulate) as SelectType | undefined)
              : (collectionConfig?.defaultPopulate as SelectType | undefined),
          showHiddenFields,
          transactionID: '',
        }),
      )

      // RECURSIVE DEPTH: If we have a related document and depth allows,
      // apply afterRead to populate its relationships
      if (relationshipValue && currentDepth < depth) {
        const sanitizedConfig = {
          ...collectionConfig,
          flattenedFields: collectionConfig?.fields,
          customIDType: 'text',
          trash: false,
          defaultPopulate: [],
        } as SanitizedCollectionConfig

        relationshipValue = await afterRead({
          collection: sanitizedConfig,
          context: {} as RequestContext,
          currentDepth: currentDepth + 1,
          depth,
          doc: relationshipValue as JsonObject,
          draft,
          fallbackLocale: fallbackLocale!,
          findMany: false,
          flattenLocales: true,
          global: null,
          locale: locale!,
          overrideAccess,
          populate: populateArg || undefined,
          req: req as RevealRequest,
          select: undefined,
          showHiddenFields,
        })
      }
    }

    if (!relationshipValue) {
      // ids are visible regardless of access controls
      relationshipValue = id
    }

    const dataToUpdateRecord = dataToUpdate as Record<string, unknown>
    if (typeof index === 'number' && typeof key === 'string') {
      const fieldRecord = dataToUpdateRecord[field.name] as Record<string, unknown>
      const localeRecords = fieldRecord[key] as Array<Record<string, unknown>>
      const localeEntry = localeRecords[index] as Record<string, unknown>
      if (field.type !== 'join' && Array.isArray(field.relationTo)) {
        localeEntry.value = relationshipValue
      } else {
        if (field.type === 'join' && Array.isArray(field.collection)) {
          localeEntry.value = relationshipValue
        } else {
          localeRecords[index] = relationshipValue as Record<string, unknown>
        }
      }
    } else if (typeof index === 'number' || typeof key === 'string') {
      const fieldRecord = dataToUpdateRecord[field.name] as Record<string, unknown>
      const target = index ?? key
      if (field.type === 'join') {
        if (!Array.isArray(field.collection)) {
          const docs = fieldRecord.docs as Array<Record<string, unknown>>
          docs[target as number] = relationshipValue as Record<string, unknown>
        } else {
          const docs = fieldRecord.docs as Array<Record<string, unknown>>
          const docEntry = docs[target as number] as Record<string, unknown>
          docEntry.value = relationshipValue
        }
      } else if (Array.isArray(field.relationTo)) {
        const entries = fieldRecord as unknown as Array<Record<string, unknown>>
        const entry = entries[target as number] as Record<string, unknown>
        entry.value = relationshipValue
      } else {
        fieldRecord[target as string] = relationshipValue
      }
    } else if (field.type !== 'join' && Array.isArray(field.relationTo)) {
      const fieldRecord = dataToUpdateRecord[field.name] as Record<string, unknown>
      fieldRecord.value = relationshipValue
    } else {
      if (field.type === 'join' && Array.isArray(field.collection)) {
        const fieldRecord = dataToUpdateRecord[field.name] as Record<string, unknown>
        fieldRecord.value = relationshipValue
      } else {
        dataToUpdateRecord[field.name] = relationshipValue
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
  siblingDoc: Record<string, unknown>
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
  const fieldForChecks = field as Field
  const populateDepth =
    fieldHasMaxDepth(fieldForChecks) && field.maxDepth! < depth ? field.maxDepth : depth
  const rowPromises: Promise<void>[] = []
  const siblingFieldValue = siblingDoc[field.name]
  const siblingFieldRecord =
    typeof siblingFieldValue === 'object' && siblingFieldValue !== null
      ? (siblingFieldValue as Record<string, unknown>)
      : null

  if (field.type === 'join' || (fieldSupportsMany(fieldForChecks) && field.hasMany)) {
    if (
      fieldShouldBeLocalized({ field: fieldForChecks, parentIsLocalized: false }) &&
      locale === 'all' &&
      siblingFieldRecord
    ) {
      Object.keys(siblingFieldRecord).forEach((localeKey) => {
        const localeValue = siblingFieldRecord[localeKey]
        if (Array.isArray(localeValue)) {
          const localeValues = localeValue as unknown[]
          localeValues.forEach((_, index) => {
            const rowPromise = async () => {
              await populate({
                currentDepth,
                data: localeValues[index],
                dataReference: resultingDoc,
                depth: populateDepth!,
                draft,
                fallbackLocale,
                field,
                index,
                key: localeKey,
                locale,
                overrideAccess,
                populateArg: populateArg || undefined,
                req,
                showHiddenFields,
              })
            }
            rowPromises.push(rowPromise())
          })
        }
      })
    } else if (
      Array.isArray(siblingFieldValue) ||
      Array.isArray(siblingFieldRecord?.docs) ||
      Array.isArray(siblingDoc[`${field.name}_ids`])
    ) {
      const docsValue = siblingFieldRecord?.docs
      const idsValue = siblingDoc[`${field.name}_ids`]
      const relationshipArray = Array.isArray(siblingFieldValue)
        ? (siblingFieldValue as unknown[])
        : Array.isArray(docsValue)
          ? (docsValue as unknown[])
          : (idsValue as unknown[])

      relationshipArray.forEach((relatedDoc, index) => {
        const rowPromise = async () => {
          if (relatedDoc) {
            const relatedDocRecord =
              typeof relatedDoc === 'object' && relatedDoc !== null
                ? (relatedDoc as Record<string, unknown>)
                : null
            const relatedId = relatedDocRecord?.id
            await populate({
              currentDepth,
              data:
                !(field.type === 'join' && Array.isArray(field.collection)) && relatedId
                  ? relatedId
                  : relatedDoc,
              dataReference: resultingDoc,
              depth: populateDepth!,
              draft,
              fallbackLocale,
              field,
              index,
              locale,
              overrideAccess,
              populateArg: populateArg || undefined,
              req,
              showHiddenFields,
            })
          }
        }

        rowPromises.push(rowPromise())
      })
    }
  } else if (field.localized && locale === 'all' && siblingFieldRecord) {
    Object.keys(siblingFieldRecord).forEach((localeKey) => {
      const rowPromise = async () => {
        await populate({
          currentDepth,
          data: siblingFieldRecord[localeKey],
          dataReference: resultingDoc,
          depth: populateDepth!,
          draft,
          fallbackLocale,
          field,
          key: localeKey,
          locale,
          overrideAccess,
          populateArg: populateArg || undefined,
          req,
          showHiddenFields,
        })
      }
      rowPromises.push(rowPromise())
    })

    await Promise.all(rowPromises)
  } else if (siblingFieldValue || siblingDoc[`${field.name}_id`]) {
    // For relationships, the data might be in the FK column
    const relationshipData = siblingFieldValue || siblingDoc[`${field.name}_id`]
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
      populateArg: populateArg || undefined,
      req,
      showHiddenFields,
    })
  }
  await Promise.all(rowPromises)
}
