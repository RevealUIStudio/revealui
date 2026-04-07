'use client';
import { FormBlockSchema } from '@revealui/contracts/content';
import type { Form as FormType } from '@revealui/core/plugins';
import { logger } from '@revealui/core/utils/logger';
import { ButtonCVA as Button } from '@revealui/presentation/server';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { memo, useState } from 'react';
import type { FieldErrors, FieldValues, UseFormRegister } from 'react-hook-form';
import { FormProvider, useForm } from 'react-hook-form';
import { ErrorBoundary } from '@/lib/components/ErrorBoundary/index';
import RichText from '@/lib/components/RichText/index';
import { asRecord } from '@/lib/utils/type-guards';
import { buildInitialFormState } from './buildInitialFormState';
import { fields } from './fields';

// Define types for form data - properly typed
export type FormFieldValue = string | number | boolean | null | undefined;
export type FormData = Record<string, FormFieldValue | FormFieldValue[]>;

// Rich text content type (Lexical format)
export interface RichTextContent {
  root: {
    type: string;
    children: Array<{
      type: string;
      version: number;
      [key: string]: unknown;
    }>;
    direction: ('ltr' | 'rtl') | null;
    format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | '';
    indent: number;
    version: number;
  };
  [key: string]: unknown;
}

// Define the FormBlockType from generated types
export type FormBlockType = {
  blockName?: string;
  blockType?: 'formBlock';
  enableIntro: boolean;
  form: FormType;
  introContent?: RichTextContent[] | null;
};

export type Props = FormBlockType;

/**
 * FormBlock Component
 *
 * Renders a form block with support for multiple field types, validation, and submission.
 * Includes error handling and loading states.
 *
 * @param enableIntro - Whether to show intro content above the form
 * @param form - Form configuration including fields, labels, and submission settings
 * @param introContent - Optional rich text content to display above the form
 *
 * @example
 * ```tsx
 * <FormBlock
 *   enableIntro={true}
 *   form={formData}
 *   introContent={introRichText}
 * />
 * ```
 */
export const FormBlock = memo(({ enableIntro, form, introContent }: Props) => {
  // Runtime validation with FormBlockSchema
  // This ensures the form block matches the schema structure
  try {
    // Validate the form block structure
    // Note: We validate the form data structure, not the entire block props
    // since Props includes additional fields from generated types
    const formBlockData = {
      type: 'form' as const,
      data: {
        fields: form.fields || [],
      },
    };
    FormBlockSchema.parse(formBlockData);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('FormBlock validation warning', { error });
    }
    // In production, we continue rendering but log the error
  }

  const { id: formID, confirmationMessage, confirmationType, redirect, submitButtonLabel } = form;

  // Initialize form methods
  const formMethods = useForm({
    defaultValues: buildInitialFormState(form.fields),
  });

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = formMethods;

  // Define state for loading, submission, and errors
  const [isLoading, setIsLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<{ message: string; status?: string } | undefined>();
  const router = useRouter();

  const onSubmit = async (data: FormData) => {
    let loadingTimerID: ReturnType<typeof setTimeout>;

    const submitForm = async () => {
      setError(undefined);

      // Validate form data structure using FormBlockSchema before submission
      try {
        const formBlockData = {
          type: 'form' as const,
          data: {
            fields: form.fields || [],
          },
        };
        FormBlockSchema.parse(formBlockData);
      } catch (validationError) {
        setError({
          message: 'Form validation failed. Please check your form configuration.',
          status: '400',
        });
        if (process.env.NODE_ENV === 'development') {
          logger.error('Form validation error', { validationError });
        }
        return;
      }

      const dataToSend = Object.entries(data).map(([name, value]) => ({
        field: name,
        value,
      }));

      // Validate submission data structure
      if (!(formID && dataToSend.length)) {
        setError({ message: 'Invalid form data' });
        return;
      }

      // Delay loading indicator by 1 second
      loadingTimerID = setTimeout(() => {
        setIsLoading(true);
      }, 1000);

      try {
        const req = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/form-submissions`, {
          body: JSON.stringify({
            form: formID,
            submissionData: dataToSend,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        });

        const res = await req.json();
        clearTimeout(loadingTimerID);

        if (req.status >= 400) {
          setIsLoading(false);
          setError({
            message: res.errors?.[0]?.message || 'Internal Server Error',
            status: res.status,
          });
          return;
        }

        setIsLoading(false);
        setHasSubmitted(true);

        if (confirmationType === 'redirect' && redirect) {
          const { url } = redirect;
          if (url) {
            try {
              const parsed = new URL(url, window.location.origin);
              if (parsed.origin !== window.location.origin) {
                return;
              }
              router.push(parsed.pathname + parsed.search);
            } catch {
              // Relative path — safe to push directly
              router.push(url);
            }
          }
        }
      } catch (_err) {
        setIsLoading(false);
        setError({
          message:
            'Unable to submit form. Please try again or contact support if the problem persists.',
        });
      }
    };

    await submitForm();
  };

  return (
    <ErrorBoundary
      fallback={
        <div className="container lg:max-w-3xl pb-20 p-4 border border-red-500 rounded bg-red-50">
          <p className="text-red-700">Error rendering form. Please refresh the page.</p>
        </div>
      }
    >
      <div className="container lg:max-w-3xl pb-20">
        <FormProvider {...formMethods}>
          {enableIntro && introContent && !hasSubmitted && (
            <RichText
              className="mb-8"
              content={Array.isArray(introContent) ? introContent[0] : introContent}
              enableGutter={false}
            />
          )}
          {isLoading && !hasSubmitted && (
            <output aria-live="polite">Loading, please wait...</output>
          )}
          {hasSubmitted && confirmationType === 'message' && confirmationMessage
            ? (() => {
                const content = Array.isArray(confirmationMessage)
                  ? confirmationMessage[0]
                  : (confirmationMessage as RichTextContent);
                if (content?.root) {
                  return (
                    <output aria-live="polite">
                      <RichText content={content} />
                    </output>
                  );
                }
                return null;
              })()
            : null}
          {error && (
            <div role="alert" aria-live="assertive">
              {`${error.status || '500'}: ${error.message || ''}`}
            </div>
          )}
          {!hasSubmitted && (
            <form
              id={formID}
              onSubmit={handleSubmit(onSubmit)}
              aria-label={form.title || 'Form'}
              noValidate
            >
              <fieldset className="mb-4 last:mb-0" aria-label="Form fields">
                {form.fields?.map((field, index) => {
                  // Type guard to narrow field type
                  if (!(field && 'blockType' in field)) {
                    return null;
                  }

                  const fieldBlockType = field.blockType as keyof typeof fields;
                  // biome-ignore lint/suspicious/noExplicitAny: Field components have dynamic props based on field type
                  const FieldComponent = fields[fieldBlockType] as React.ComponentType<any>;

                  if (FieldComponent) {
                    const key =
                      field?.id ?? ('name' in field ? field.name : undefined) ?? `field-${index}`;
                    const fieldProps = asRecord(field);
                    return (
                      <div className="mb-6 last:mb-0" key={key}>
                        <FieldComponent
                          {...fieldProps}
                          errors={errors as FieldErrors<FieldValues>}
                          register={register as UseFormRegister<FieldValues>}
                        />
                      </div>
                    );
                  }
                  return null;
                })}
              </fieldset>
              <Button form={formID} type="submit" variant="default">
                {submitButtonLabel}
              </Button>
            </form>
          )}
        </FormProvider>
      </div>
    </ErrorBoundary>
  );
});

FormBlock.displayName = 'FormBlock';
