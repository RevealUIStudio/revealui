import { relationshipPopulationPromise } from '../../../relationships/population.js'
import type {
  JsonObject,
  PopulateType,
  RequestContext,
  RevealRequest,
  SanitizedCollectionConfig,
  SanitizedGlobalConfig,
  SelectMode,
  SelectType,
  TypedFallbackLocale,
} from '../../../types/index.js'
import { stripUnselectedFields } from '../../../utils/stripUnselectedFields.js'
import type { Block, Field, TabAsField } from '../../config/types.js'
import type { AfterReadArgs } from './index.js'
import { traverseFields } from './traverseFields.js'

type Args = {
  /**
   * Data of the nearest parent block. If no parent block exists, this will be the `undefined`
   */
  blockData?: JsonObject
  collection: null | SanitizedCollectionConfig
  context: RequestContext
  currentDepth: number
  depth: number
  doc: JsonObject
  draft: boolean
  fallbackLocale: TypedFallbackLocale
  field: Field | TabAsField
  fieldIndex: number
  /**
   * fieldPromises are used for things like field hooks. They should be awaited before awaiting populationPromises
   */
  fieldPromises: Promise<void>[]
  findMany: boolean
  global: null | SanitizedGlobalConfig
  locale: null | string
  overrideAccess: boolean
  parentIndexPath: string
  /**
   * @todo make required in v4.0
   */
  parentIsLocalized?: boolean
  parentPath: string
  parentSchemaPath: string
  populate?: PopulateType
  populationPromises: Promise<void>[]
  req: RevealRequest
  select?: SelectType
  selectMode?: SelectMode
  showHiddenFields: boolean
  siblingDoc: JsonObject
  siblingFields?: (Field | TabAsField)[]
  triggerAccessControl?: boolean
  triggerHooks?: boolean
} & Required<Pick<AfterReadArgs<JsonObject>, 'flattenLocales'>>

// This function is responsible for the following actions, in order:
// - Remove hidden fields from response
// - Flatten locales into requested locale
// - Sanitize outgoing data (point field, etc.)
// - Execute field hooks
// - Execute read access control
// - Populate relationships

export const promise = async ({
  blockData,
  collection,
  context,
  currentDepth,
  depth,
  doc,
  draft,
  fallbackLocale,
  field,
  fieldIndex,
  fieldPromises,
  findMany,
  flattenLocales,
  global,
  locale,
  overrideAccess,
  parentIndexPath,
  parentIsLocalized,
  parentPath,
  parentSchemaPath,
  populate,
  populationPromises,
  req,
  select,
  selectMode,
  showHiddenFields,
  siblingDoc,
  siblingFields,
  triggerAccessControl = true,
  triggerHooks = true,
}: Args): Promise<void> => {
  const fieldName = field.name || ''
  const fieldPath = `${parentPath}${fieldName}`

  // Exit early if field is not selected
  const selectObj = select as Record<string, unknown> | undefined
  if (
    select &&
    selectMode === 'include' &&
    !selectObj?.[fieldName] &&
    !selectObj?.[`${fieldName}.*`] &&
    !selectObj?.[fieldPath]
  ) {
    return
  }

  // Strip unselected sub-fields
  if (
    select &&
    selectMode === 'include' &&
    selectObj?.[fieldName] &&
    typeof selectObj[fieldName] === 'object'
  ) {
    stripUnselectedFields({
      field,
      select: selectObj[fieldName] as SelectType,
      siblingDoc,
    })
  }

  // Execute beforeRead field hook
  if (triggerHooks && field.hooks?.beforeRead?.length) {
    for (const hook of field.hooks.beforeRead) {
      await hook({
        collection: collection?.slug,
        context,
        doc: siblingDoc,
        field,
        findMany,
        global: global?.slug,
        locale,
        overrideAccess,
        req,
        select,
        showHiddenFields,
        siblingDoc,
      })
    }
  }

  // Relationship population
  if (
    (field.type === 'relationship' || field.type === 'upload') &&
    (siblingDoc[fieldName] !== undefined || siblingDoc[`${fieldName}_id`] !== undefined)
  ) {
    populationPromises.push(
      relationshipPopulationPromise({
        currentDepth,
        depth,
        draft,
        fallbackLocale,
        field: field as {
          type: 'relationship' | 'upload' | 'join'
          name: string
          relationTo?: string | string[]
          collection?: string | string[]
          hasMany?: boolean
          maxDepth?: number
          localized?: boolean
        },
        locale,
        overrideAccess,
        populate: populate,
        req: req as {
          revealui?: {
            collections?: Record<string, { config?: { defaultPopulate?: unknown } }>
            config?: { collections?: unknown[] }
          }
          dataLoader?: {
            load?: (key: string) => Promise<unknown>
            find?: (options: unknown) => Promise<unknown>
          }
          transactionID?: string | number | null
        },
        showHiddenFields,
        siblingDoc,
      }),
    )
  }

  // Handle field types that have nested fields
  switch (field.type) {
    case 'array': {
      const rows = siblingDoc[fieldName] as JsonObject
      if (Array.isArray(rows)) {
        rows.forEach((rowData, rowIndex) => {
          if (rowData) {
            traverseFields({
              blockData,
              collection,
              context,
              currentDepth,
              depth,
              doc: rowData,
              draft,
              fallbackLocale,
              fieldPromises,
              fields: ((field as { fields?: Field[] }).fields || []) as Field[],
              findMany,
              flattenLocales,
              global,
              locale,
              overrideAccess,
              parentIndexPath: `${parentIndexPath}${fieldIndex}-`,
              parentIsLocalized: parentIsLocalized!,
              parentPath: `${fieldPath}.${rowIndex}.`,
              parentSchemaPath: `${parentSchemaPath}${fieldName}.${rowIndex}.`,
              populate,
              populationPromises,
              req,
              select,
              selectMode,
              showHiddenFields,
              siblingDoc: rowData,
            })
          }
        })
      }
      break
    }

    case 'blocks': {
      const blockData = siblingDoc[fieldName]
      if (Array.isArray(blockData)) {
        blockData.forEach((block, blockIndex) => {
          if (block && typeof block === 'object') {
            const blocksField = field as { blocks?: Block[] }
            const blockConfig = blocksField.blocks?.find(
              (blockConf: Block) => blockConf.slug === (block as { blockType?: string }).blockType,
            )

            if (blockConfig) {
              traverseFields({
                blockData: block,
                collection,
                context,
                currentDepth,
                depth,
                doc: block,
                draft,
                fallbackLocale,
                fieldPromises,
                fields: blockConfig.fields,
                findMany,
                flattenLocales,
                global,
                locale,
                overrideAccess,
                parentIndexPath: `${parentIndexPath}${fieldIndex}-`,
                parentIsLocalized: parentIsLocalized!,
                parentPath: `${fieldPath}.${blockIndex}.`,
                parentSchemaPath: `${parentSchemaPath}${field.name}.${blockIndex}.`,
                populate,
                populationPromises,
                req,
                select,
                selectMode,
                showHiddenFields,
                siblingDoc: block,
              })
            }
          }
        })
      }
      break
    }

    default:
      break
  }

  // Execute afterRead field hook
  if (triggerHooks && field.hooks?.afterRead?.length) {
    for (const hook of field.hooks.afterRead) {
      await hook({
        collection: collection?.slug,
        context,
        doc: siblingDoc,
        field,
        findMany,
        global: global?.slug,
        locale,
        overrideAccess,
        req,
        select,
        showHiddenFields,
        siblingDoc,
      })
    }
  }
}
