import type React from 'react'
import type { Block, Field, RevealUIBlock, RevealUIContext } from '../types/index.js'
import { convertToRevealUIField } from './field-conversion.js'

// Convert from standard block to RevealUI block
export function convertToRevealUIBlock(block: Block): RevealUIBlock {
  return {
    slug: block.slug,
    fields: block.fields.map(convertToRevealUIField),
    revealUI: {
      category: 'content',
      icon: 'block',
      preview: undefined,
      permissions: ['read', 'write'],
      tenantScoped: false,
    },
    labels: block.labels || { singular: block.slug, plural: `${block.slug}s` },
  }
}

// Convert from RevealUI block to standard block
export function convertFromRevealUIBlock(revealUIBlock: RevealUIBlock): Block {
  return {
    slug: revealUIBlock.slug,
    fields: revealUIBlock.fields.map((field) => ({
      name: field.name,
      type: field.type,
      label: field.label,
      required: field.required,
      admin: field.admin,
      validate: field.validate,
    })),
    labels: revealUIBlock.labels,
  }
}

// Enhance a standard block with RevealUI features
export function enhanceBlockWithRevealUI(
  block: Block,
  revealUIOptions?: RevealUIBlock['revealUI'],
): RevealUIBlock {
  const revealUIBlock = convertToRevealUIBlock(block)

  if (revealUIOptions) {
    revealUIBlock.revealUI = {
      ...revealUIBlock.revealUI,
      ...revealUIOptions,
    }
  }

  return revealUIBlock
}

/**
 * Validate a RevealUI block
 *
 * @async
 * @param block - The RevealUI block to validate
 * @param data - The data to validate against the block
 * @param context - The RevealUI context for validation
 * @returns Promise resolving to a record of field errors (empty if valid)
 */
export async function validateRevealUIBlock(
  block: RevealUIBlock,
  data: Record<string, unknown>,
  context: RevealUIContext,
): Promise<Record<string, string>> {
  const errors: Record<string, string> = {}

  // Validate each field in the block
  for (const field of block.fields) {
    if (!field.name) continue // Skip fields without names

    const value = data[field.name]
    const validationContext = {
      data,
      siblingData: data,
      user: context.user ?? undefined,
      tenant: context.tenant as string | undefined,
      operation: 'update' as const,
    }

    // Import the validation function dynamically to avoid circular imports
    const { validateRevealUIField } = await import('./field-conversion.js')
    const result = validateRevealUIField(field, value, validationContext)

    if (result !== true) {
      errors[field.name] = result
    }
  }

  return errors
}

// Get a React component for rendering a RevealUI block
export function getRevealUIBlockComponent(block: RevealUIBlock): React.ComponentType<{
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
  revealUI?: RevealUIContext
}> {
  return function RevealUIBlockComponent({ data, onChange, revealUI }) {
    void revealUI
    const blockFields: Array<Pick<Field, 'name' | 'type' | 'label' | 'required'>> =
      block.fields.map((field) => {
        return {
          name: field.name,
          type: field.type,
          label: field.label,
          required: field.required,
        }
      })

    const formatValue = (value: unknown): string => {
      if (value === null || value === undefined) return ''
      if (typeof value === 'string') return value
      if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value)
      }
      if (typeof value === 'symbol') return value.description ?? value.toString()
      if (typeof value === 'function') return value.name || 'function'
      return JSON.stringify(value)
    }

    return (
      <div className="reveal-ui-block" data-block-slug={block.slug}>
        <div className="reveal-ui-block-fields">
          {blockFields.map((field) => {
            const fieldName = typeof field.name === 'string' ? field.name : ''
            const fieldLabel = typeof field.label === 'string' ? field.label : fieldName || 'Field'
            const value = fieldName ? data[fieldName] : undefined
            return (
              <div key={fieldName || Math.random()} className="reveal-ui-field">
                <label className="reveal-ui-field-label" htmlFor={`field-${fieldName}`}>
                  {fieldLabel}
                  {field.required && <span className="required">*</span>}
                </label>
                <div className="reveal-ui-field-input">
                  {/* Placeholder for field rendering - would need actual field components */}
                  <input
                    type="text"
                    id={`field-${fieldName}`}
                    value={formatValue(value)}
                    onChange={(e) => onChange({ ...data, [fieldName]: e.target.value })}
                    required={field.required}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
}
