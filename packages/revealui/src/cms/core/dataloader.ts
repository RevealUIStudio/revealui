import type { BatchLoadFn } from 'dataloader'

import DataLoader from 'dataloader'

import type { RevealUIInstance, TypedFallbackLocale } from '../index.ts'
import type { RevealRequest, PopulateType, SelectType, FindArgs, OperationOptions, TypeWithID } from '../types/index.ts'

import { isValidID } from '../utilities/isValidID.ts'

// RevealUI uses `dataloader` to solve the classic GraphQL N+1 problem.

// We keep a list of all documents requested to be populated for any given request
// and then batch together documents within the same collection,
// making only 1 find per each collection, rather than `findByID` per each requested doc.

// This dramatically improves performance for REST and Local API `depth` populations,
// and also ensures complex GraphQL queries perform lightning-fast.

const batchAndLoadDocs =
  (req: RevealRequest): BatchLoadFn<string, TypeWithID> =>
  async (keys: readonly string[]): Promise<TypeWithID[]> => {
    const revealui = req.revealui

    if (!revealui) {
      throw new Error('RevealUI instance not available on request')
    }

    // Create docs array of same length as keys, using null as value
    // We will replace nulls with injected docs as they are retrieved
    const docs: (null | TypeWithID)[] = keys.map(() => null)

    /**
    * Batch IDs by their `find` args
    * so we can make one find query per combination of collection, depth, locale, and fallbackLocale.
    *
    * Resulting shape will be as follows:
      {
        // key is stringified set of find args
        '[null,"pages",2,0,"es","en",false,false]': [
          // value is array of IDs to find with these args
          'q34tl23462346234524',
          '435523540194324280',
          '2346245j35l3j5234532li',
        ],
        // etc
      };
    *
    **/

    const batchByFindArgs: Record<string, string[]> = {}

    for (const key of keys) {
      const [
        transactionID,
        collection,
        id,
        depth,
        currentDepth,
        locale,
        fallbackLocale,
        overrideAccess,
        showHiddenFields,
        draft,
        select,
        populate,
      ] = JSON.parse(key)

      const batchKeyArray = [
        transactionID,
        collection,
        depth,
        currentDepth,
        locale,
        fallbackLocale,
        overrideAccess,
        showHiddenFields,
        draft,
        select,
        populate,
      ]

      const batchKey = JSON.stringify(batchKeyArray)

      // RevealUI uses text IDs by default
      const idType = 'text' as const
      const sanitizedID = id as string

      if (isValidID(sanitizedID, idType)) {
        batchByFindArgs[batchKey] = [...(batchByFindArgs[batchKey] || []), sanitizedID]
      }
    }

    // Run find requests one after another, so as to not hang transactions

    for (const [batchKey, ids] of Object.entries(batchByFindArgs)) {
      const [
        transactionID,
        collection,
        depth,
        currentDepth,
        locale,
        fallbackLocale,
        overrideAccess,
        showHiddenFields,
        draft,
        select,
        populate,
      ] = JSON.parse(batchKey)

      req.transactionID = transactionID

      const result = await revealui.find({
        collection,
        currentDepth,
        depth,
        disableErrors: true,
        draft,
        fallbackLocale,
        locale,
        overrideAccess: Boolean(overrideAccess),
        pagination: false,
        populate,
        req,
        select,
        showHiddenFields: Boolean(showHiddenFields),
        where: {
          id: {
            in: ids,
          },
        },
      })

      // For each returned doc, find index in original keys
      // Inject doc within docs array if index exists
      for (const doc of result.docs) {
        const docKey = createDataloaderCacheKey({
          collectionSlug: collection,
          currentDepth,
          depth,
          docID: doc.id,
          draft,
          fallbackLocale,
          locale,
          overrideAccess,
          populate,
          select,
          showHiddenFields,
          transactionID: req.transactionID!,
        })
        const docsIndex = keys.findIndex((key) => key === docKey)

        if (docsIndex > -1) {
          docs[docsIndex] = doc
        }
      }
    }

    // Return docs array,
    // which has now been injected with all fetched docs
    // and should match the length of the incoming keys arg
    return docs as TypeWithID[]
  }

export const getDataLoader = (req: RevealRequest) => {
  const findQueries = new Map()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataLoader = new DataLoader(batchAndLoadDocs(req)) as any

  dataLoader.find = ((args: FindArgs) => {
    const key = createFindDataloaderCacheKey(args)
    const cached = findQueries.get(key)
    if (cached) {
      return cached
    }
    if (!req.revealui) {
      throw new Error('RevealUI instance not available on request')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const request = (req.revealui as any).find(args)
    findQueries.set(key, request)
    return request
  })

  return dataLoader
}

const createFindDataloaderCacheKey = ({
  collection,
  currentDepth,
  depth,
  disableErrors,
  draft,
  includeLockStatus,
  joins,
  limit,
  overrideAccess,
  page,
  pagination,
  populate,
  req,
  select,
  showHiddenFields,
  sort,
  where,
}: OperationOptions): string =>
  JSON.stringify([
    collection,
    currentDepth,
    depth,
    disableErrors,
    draft,
    includeLockStatus,
    joins,
    limit,
    overrideAccess,
    page,
    pagination,
    populate,
    req?.transactionID,
    select,
    showHiddenFields,
    sort,
    where,
  ])

type CreateCacheKeyArgs = {
  collectionSlug: string
  currentDepth: number
  depth: number
  docID: number | string
  draft: boolean
  fallbackLocale: TypedFallbackLocale
  locale: string | string[]
  overrideAccess: boolean
  populate?: PopulateType
  select?: SelectType
  showHiddenFields: boolean
  transactionID: number | Promise<number | string> | string
}
export const createDataloaderCacheKey = ({
  collectionSlug,
  currentDepth,
  depth,
  docID,
  draft,
  fallbackLocale,
  locale,
  overrideAccess,
  populate,
  select,
  showHiddenFields,
  transactionID,
}: CreateCacheKeyArgs): string =>
  JSON.stringify([
    transactionID,
    collectionSlug,
    docID,
    depth,
    currentDepth,
    locale,
    fallbackLocale,
    overrideAccess,
    showHiddenFields,
    draft,
    select,
    populate,
  ])