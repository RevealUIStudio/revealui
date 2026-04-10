import type { CollectionConfig } from '@revealui/contracts/admin';
import type { Plugin, RevealCollectionConfig, RevealUIField } from '../types/index.js';

// Base form field interface with common properties
export interface BaseFormField extends RevealUIField {
  // These are already in Field, but we reinforce them here
  name: string;
  label?: string;
  width?: number | string;
  defaultValue?: string | number | boolean | null;
  required?: boolean;
  placeholder?: string;
}

// Form field types (compatible with RevealUI form builder)
export interface TextField extends BaseFormField {
  type: 'text';
  maxLength?: number;
  minLength?: number;
}

export interface EmailField extends BaseFormField {
  type: 'email';
}

export interface TextareaField extends BaseFormField {
  type: 'textarea';
  maxLength?: number;
  minLength?: number;
}

export interface NumberField extends BaseFormField {
  type: 'number';
  max?: number;
  min?: number;
}

export interface SelectField extends BaseFormField {
  type: 'select';
  options: Array<{ label: string; value: string }>;
}

export interface CheckboxField extends Omit<BaseFormField, 'defaultValue'> {
  type: 'checkbox';
  defaultValue?: boolean;
}

export interface CountryField extends BaseFormField {
  type: 'text'; // Basic implementation
}

export interface StateField extends BaseFormField {
  type: 'text'; // Basic implementation
}

export interface FormFieldBlock {
  name: string;
  label?: string;
  type: string;
  blockType: string;
  blockName?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  width?: number;
  id?: string;
}

export interface Form {
  id: string;
  title: string;
  fields: FormFieldBlock[];
  confirmationMessage?: unknown; // Rich text content
  confirmationType?: 'message' | 'redirect';
  submitButtonLabel?: string;
  redirect?: { url?: string };
  emails?: Array<{
    emailTo?: string;
    emailFrom?: string;
    subject: string;
    message?: unknown; // Rich text content
    cc?: string;
    bcc?: string;
    replyTo?: string;
  }>;
}

export interface FormSubmission {
  id: string;
  form: string;
  submissionData: Record<string, unknown>;
  submittedAt: string;
}

export interface FormBuilderPluginConfig {
  fields?: {
    payment?: boolean;
  };
  formOverrides?: {
    fields?: (args: { defaultFields: RevealUIField[] }) => RevealUIField[];
    slug?: string;
    admin?: {
      useAsTitle?: string;
      defaultColumns?: string[];
      components?: Record<string, string>;
    };
  };
  formSubmissionOverrides?: {
    fields?: (args: { defaultFields: RevealUIField[] }) => RevealUIField[];
    slug?: string;
    admin?: {
      useAsTitle?: string;
      defaultColumns?: string[];
      components?: Record<string, string>;
    };
  };
}

export function formBuilderPlugin(config: FormBuilderPluginConfig = {}): Plugin {
  return (incomingConfig) => {
    // Default form fields
    const defaultFormFields: RevealUIField[] = [
      {
        name: 'title',
        type: 'text',
        required: true,
        admin: {
          description: 'The title of your form',
        },
      },
      {
        name: 'fields',
        type: 'array',
        required: true,
        fields: [
          {
            name: 'name',
            type: 'text',
            required: true,
            admin: {
              description: 'The field name used for form submission',
            },
          },
          {
            name: 'label',
            type: 'text',
            required: true,
            admin: {
              description: 'The label displayed to users',
            },
          },
          {
            name: 'type',
            type: 'select',
            required: true,
            options: [
              { label: 'Text', value: 'text' },
              { label: 'Email', value: 'email' },
              { label: 'Textarea', value: 'textarea' },
              { label: 'Checkbox', value: 'checkbox' },
              { label: 'Select', value: 'select' },
              { label: 'Radio', value: 'radio' },
              { label: 'Number', value: 'number' },
              { label: 'Date', value: 'date' },
              { label: 'Phone', value: 'phone' },
              { label: 'Country', value: 'country' },
            ],
            admin: {
              description: 'The type of input field',
            },
          },
          {
            name: 'placeholder',
            type: 'text',
            admin: {
              description: 'Placeholder text for the input',
            },
          },
          {
            name: 'required',
            type: 'checkbox',
            admin: {
              description: 'Make this field required',
            },
          },
          {
            name: 'defaultValue',
            type: 'text',
            admin: {
              description: 'Default value for the field',
            },
          },
          {
            name: 'options',
            type: 'array',
            fields: [
              {
                name: 'label',
                type: 'text',
                required: true,
              },
              {
                name: 'value',
                type: 'text',
                required: true,
              },
            ],
            admin: {
              condition: (_data: Record<string, unknown>, siblingData: Record<string, unknown>) =>
                ['select', 'radio', 'checkbox'].includes(siblingData?.type as string),
              description: 'Options for select, radio, and checkbox fields',
            },
          },
          {
            name: 'width',
            type: 'number',
            min: 1,
            max: 100,
            admin: {
              description: 'Width percentage (1-100)',
            },
          },
        ],
        admin: {
          description: 'The fields that will be displayed in your form',
        },
      },
      {
        name: 'confirmationMessage',
        type: 'richText',
        admin: {
          description: 'Message shown after successful form submission',
        },
      },
      {
        name: 'redirect',
        type: 'group',
        fields: [
          {
            name: 'url',
            type: 'text',
            admin: {
              description: 'URL to redirect to after form submission',
            },
          },
        ],
      },
      {
        name: 'emails',
        type: 'array',
        fields: [
          {
            name: 'emailTo',
            type: 'email',
            required: true,
            admin: {
              description: 'Email address to send form submissions to',
            },
          },
          {
            name: 'emailFrom',
            type: 'email',
            admin: {
              description: 'From email address (optional)',
            },
          },
          {
            name: 'subject',
            type: 'text',
            required: true,
            defaultValue: 'New Form Submission',
            admin: {
              description: 'Email subject line',
            },
          },
          {
            name: 'message',
            type: 'richText',
            admin: {
              description: 'Custom email message (optional)',
            },
          },
        ],
        admin: {
          description: 'Configure email notifications for form submissions',
        },
      },
    ];

    // Default submission fields
    const defaultSubmissionFields: RevealUIField[] = [
      {
        name: 'form',
        type: 'relationship',
        relationTo: 'forms',
        required: true,
        admin: {
          readOnly: true,
        },
      },
      {
        name: 'submissionData',
        type: 'json',
        required: true,
        admin: {
          readOnly: true,
          description: 'The raw form submission data',
        },
      },
      {
        name: 'submittedAt',
        type: 'date',
        required: true,
        admin: {
          readOnly: true,
        },
      },
    ];

    // Create form collection
    const formSlug = config.formOverrides?.slug || 'forms';
    // biome-ignore lint/suspicious/noExplicitAny: Plugin collections can work with any document type
    const formCollection: RevealCollectionConfig<any> = {
      slug: formSlug,
      admin: {
        useAsTitle: 'title',
        ...config.formOverrides?.admin,
      },
      fields: config.formOverrides?.fields
        ? config.formOverrides.fields({ defaultFields: defaultFormFields })
        : defaultFormFields,
      timestamps: true,
    };

    // Create submissions collection
    const submissionSlug = config.formSubmissionOverrides?.slug || 'form-submissions';
    // biome-ignore lint/suspicious/noExplicitAny: Plugin collections can work with any document type
    const submissionsCollection: RevealCollectionConfig<any> = {
      slug: submissionSlug,
      admin: {
        useAsTitle: 'id',
        ...config.formSubmissionOverrides?.admin,
      },
      fields: config.formSubmissionOverrides?.fields
        ? config.formSubmissionOverrides.fields({
            defaultFields: defaultSubmissionFields,
          })
        : defaultSubmissionFields,
      timestamps: true,
    };

    // Add collections to config
    incomingConfig.collections = [
      ...(incomingConfig.collections || []),
      // biome-ignore lint/suspicious/noExplicitAny: invariant generic needs any for heterogeneous array
      formCollection as unknown as CollectionConfig<any>,
      // biome-ignore lint/suspicious/noExplicitAny: invariant generic needs any for heterogeneous array
      submissionsCollection as unknown as CollectionConfig<any>,
    ];

    return incomingConfig;
  };
}
