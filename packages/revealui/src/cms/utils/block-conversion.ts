import type { Block } from '../types/index';
import type {
  RevealUIBlock,
  RevealUIBlockPreview,
  RevealUIField,
  RevealUIContext
} from '../types/index';
import { convertToRevealUIField } from './field-conversion';

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
      tenantScoped: false
    },
    labels: block.labels
  };
}

// Convert from RevealUI block to standard block
export function convertFromRevealUIBlock(revealUIBlock: RevealUIBlock): Block {
  return {
    slug: revealUIBlock.slug,
    fields: revealUIBlock.fields.map(field => ({
      name: field.name,
      type: field.type,
      label: field.label,
      required: field.required,
      admin: field.admin,
      validate: field.validate
    })),
    labels: revealUIBlock.labels
  };
}

// Enhance a standard block with RevealUI features
export function enhanceBlockWithRevealUI(block: Block, revealUIOptions?: RevealUIBlock['revealUI']): RevealUIBlock {
  const revealUIBlock = convertToRevealUIBlock(block);

  if (revealUIOptions) {
    revealUIBlock.revealUI = {
      ...revealUIBlock.revealUI,
      ...revealUIOptions
    };
  }

  return revealUIBlock;
}

// Validate a RevealUI block
export function validateRevealUIBlock(block: RevealUIBlock, data: Record<string, unknown>, context: RevealUIContext): Record<string, string> {
  const errors: Record<string, string> = {};

  // Validate each field in the block
  for (const field of block.fields) {
    const value = data[field.name];
    const validationContext = {
      data,
      siblingData: data,
      user: context.user!,
      tenant: context.tenant,
      operation: 'update' as const
    };

    // Import the validation function dynamically to avoid circular imports
    const { validateRevealUIField } = require('./field-conversion.ts');
    const result = validateRevealUIField(field, value, validationContext);

    if (result !== true) {
      errors[field.name] = result;
    }
  }

  return errors;
}

// Get a React component for rendering a RevealUI block
export function getRevealUIBlockComponent(block: RevealUIBlock): React.ComponentType<{
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  revealUI?: RevealUIContext;
}> {
  return function RevealUIBlockComponent({ data, onChange, revealUI }) {
    return (
      <div className="reveal-ui-block" data-block-slug={block.slug}>
        <div className="reveal-ui-block-fields">
          {block.fields.map(field => (
            <div key={field.name} className="reveal-ui-field">
              <label className="reveal-ui-field-label">
                {field.label || field.name}
                {field.required && <span className="required">*</span>}
              </label>
              <div className="reveal-ui-field-input">
                {/* Placeholder for field rendering - would need actual field components */}
                <input
                  type="text"
                  value={String(data[field.name] || '')}
                  onChange={(e) => onChange({ ...data, [field.name]: e.target.value })}
                  required={field.required}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
}
