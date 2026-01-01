import type { Plugin, Field, CollectionConfig, Document } from '../types/index';

// Form field types (compatible with PayloadCMS form builder)
export interface TextField extends Field {
  type: 'text';
  maxLength?: number;
  minLength?: number;
}

export interface EmailField extends Field {
  type: 'email';
}

export interface TextareaField extends Field {
  type: 'textarea';
  maxLength?: number;
  minLength?: number;
}

export interface NumberField extends Field {
  type: 'number';
  max?: number;
  min?: number;
}

export interface SelectField extends Field {
  type: 'select';
  options: Array<{ label: string; value: string }>;
}

export interface CheckboxField extends Field {
  type: 'checkbox';
}

export interface CountryField extends Field {
  type: 'text'; // Basic implementation
}

export interface StateField extends Field {
  type: 'text'; // Basic implementation
}

export interface FormFieldBlock {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  width?: number;
}

export interface Form {
  id: string;
  title: string;
  fields: FormFieldBlock[];
  confirmationMessage?: string;
  redirect?: { url?: string };
  emails?: Array<{
    emailTo: string;
    emailFrom?: string;
    subject: string;
    message?: string;
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
    fields?: (args: { defaultFields: Field[] }) => Field[];
    slug?: string;
    admin?: {
      useAsTitle?: string;
      defaultColumns?: string[];
      components?: Record<string, string>;
    };
  };
  formSubmissionOverrides?: {
    fields?: (args: { defaultFields: Field[] }) => Field[];
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
    const defaultFormFields: Field[] = [
      {
        name: 'title',
        type: 'text',
        required: true,
        admin: {
          description: 'The title of your form'
        }
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
              description: 'The field name used for form submission'
            }
          },
          {
            name: 'label',
            type: 'text',
            required: true,
            admin: {
              description: 'The label displayed to users'
            }
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
              description: 'The type of input field'
            }
          },
          {
            name: 'placeholder',
            type: 'text',
            admin: {
              description: 'Placeholder text for the input'
            }
          },
          {
            name: 'required',
            type: 'checkbox',
            admin: {
              description: 'Make this field required'
            }
          },
          {
            name: 'defaultValue',
            type: 'text',
            admin: {
              description: 'Default value for the field'
            }
          },
          {
            name: 'options',
            type: 'array',
            fields: [
              {
                name: 'label',
                type: 'text',
                required: true
              },
              {
                name: 'value',
                type: 'text',
                required: true
              }
            ],
            admin: {
              condition: (data, siblingData) =>
                ['select', 'radio', 'checkbox'].includes(siblingData?.type),
              description: 'Options for select, radio, and checkbox fields'
            }
          },
          {
            name: 'width',
            type: 'number',
            min: 1,
            max: 100,
            admin: {
              description: 'Width percentage (1-100)'
            }
          }
        ],
        admin: {
          description: 'The fields that will be displayed in your form'
        }
      },
      {
        name: 'confirmationMessage',
        type: 'richText',
        admin: {
          description: 'Message shown after successful form submission'
        }
      },
      {
        name: 'redirect',
        type: 'group',
        fields: [
          {
            name: 'url',
            type: 'text',
            admin: {
              description: 'URL to redirect to after form submission'
            }
          }
        ]
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
              description: 'Email address to send form submissions to'
            }
          },
          {
            name: 'emailFrom',
            type: 'email',
            admin: {
              description: 'From email address (optional)'
            }
          },
          {
            name: 'subject',
            type: 'text',
            required: true,
            defaultValue: 'New Form Submission',
            admin: {
              description: 'Email subject line'
            }
          },
          {
            name: 'message',
            type: 'richText',
            admin: {
              description: 'Custom email message (optional)'
            }
          }
        ],
        admin: {
          description: 'Configure email notifications for form submissions'
        }
      }
    ];

    // Default submission fields
    const defaultSubmissionFields: Field[] = [
      {
        name: 'form',
        type: 'relationship',
        relationTo: 'forms',
        required: true,
        admin: {
          readOnly: true
        }
      },
      {
        name: 'submissionData',
        type: 'json',
        required: true,
        admin: {
          readOnly: true,
          description: 'The raw form submission data'
        }
      },
      {
        name: 'submittedAt',
        type: 'date',
        required: true,
        admin: {
          readOnly: true
        }
      }
    ];

    // Create form collection
    const formSlug = config.formOverrides?.slug || 'forms';
    const formCollection: CollectionConfig = {
      slug: formSlug,
      admin: {
        useAsTitle: 'title',
        ...config.formOverrides?.admin
      },
      fields: config.formOverrides?.fields
        ? config.formOverrides.fields({ defaultFields: defaultFormFields })
        : defaultFormFields,
      timestamps: true
    };

    // Create submissions collection
    const submissionSlug = config.formSubmissionOverrides?.slug || 'form-submissions';
    const submissionsCollection: CollectionConfig = {
      slug: submissionSlug,
      admin: {
        useAsTitle: 'id',
        ...config.formSubmissionOverrides?.admin
      },
      fields: config.formSubmissionOverrides?.fields
        ? config.formSubmissionOverrides.fields({ defaultFields: defaultSubmissionFields })
        : defaultSubmissionFields,
      timestamps: true
    };

    // Add collections to config
    incomingConfig.collections = [
      ...(incomingConfig.collections || []),
      formCollection,
      submissionsCollection,
    ];

    return incomingConfig;
  };
}

