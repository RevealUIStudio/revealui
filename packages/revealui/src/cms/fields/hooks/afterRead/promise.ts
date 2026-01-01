import type { RichTextAdapter } from '../../../admin/RichText.js'
import type { SanitizedCollectionConfig, SanitizedGlobalConfig, RequestContext, TypedFallbackLocale } from '../../../types/index.js'
import type {
  JsonObject,
  PayloadRequest,
  PopulateType,
  SelectMode,
  SelectType,
} from '../../../types/index.js'
import type { Block, Field, TabAsField } from '../../config/types.js'
import type { AfterReadArgs } from './index.js'

import { MissingEditorProp } from '../../../errors/index.js'
import { getBlockSelect } from '../../../utilities/getBlockSelect.js'
import { stripUnselectedFields } from '../../../utilities/stripUnselectedFields.js'
import { fieldAffectsData, fieldShouldBeLocalized, tabHasName } from '../../config/types.js'
import { getDefaultValue } from '../../getDefaultValue.js'
import { getFieldPathsModified as getFieldPaths } from '../../getFieldPaths.js'
import { relationshipPopulationPromise } from '../../../core/relationshipPopulationPromise.js'
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
  req: PayloadRequest
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
  const fieldPath = `${parentPath}${field.name}`

  // Exit early if field is not selected
  if (
    select &&
    selectMode === 'include' &&
    !select[field.name] &&
    !select[`${field.name}.*`] &&
    !select[fieldPath]
  ) {
    return
  }

  // Strip unselected sub-fields
  if (
    select &&
    selectMode === 'include' &&
    select[field.name] &&
    typeof select[field.name] === 'object'
  ) {
    stripUnselectedFields({
      field,
      select: select[field.name] as SelectType,
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
    (siblingDoc[field.name] !== undefined || siblingDoc[field.name + '_id'] !== undefined)
  ) {
    populationPromises.push(
      relationshipPopulationPromise({
        currentDepth,
        depth,
        draft,
        fallbackLocale,
        field,
        locale,
        overrideAccess,
        populate: populate,
        req,
        showHiddenFields,
        siblingDoc,
      }),
    )
  }

  // Handle field types that have nested fields
  switch (field.type) {
    case 'array': {
      const rows = siblingDoc[field.name] as JsonObject
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
              fields: (field as any).fields,
              findMany,
              flattenLocales,
              global,
              locale,
              overrideAccess,
              parentIndexPath: `${parentIndexPath}${fieldIndex}-`,
              parentIsLocalized: parentIsLocalized!,
              parentPath: `${fieldPath}.${rowIndex}.`,
              parentSchemaPath: `${parentSchemaPath}${field.name}.${rowIndex}.`,
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
      const blockData = siblingDoc[field.name]
      if (Array.isArray(blockData)) {
        blockData.forEach((block, blockIndex) => {
          if (block && typeof block === 'object') {
            const blockConfig = (field as any).blocks.find(
              (blockConf: Block) => blockConf.slug === block.blockType,
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