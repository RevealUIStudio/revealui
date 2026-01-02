/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import type { Form as FormType } from '@revealui/cms/plugins'
import { useRouter } from 'next/navigation'
import type React from 'react'
import { useCallback, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import RichText from '../../components/RichText'
import { Button } from '../../components/ui/button'
import { buildInitialFormState } from './buildInitialFormState'
import { fields } from './fields'

// Define types for form data
export type Value = any
export interface Property {
  [key: string]: Value
}
export interface Data {
  [key: string]: Property | Property[]
}

// Define the FormBlockType
export type FormBlockType = {
  blockName?: string
  blockType?: 'formBlock'
  enableIntro: boolean
  form: FormType
  introContent?: Record<string, any>[] // More explicit type for introContent
}

export type Props = FormBlockType

// Define your FormBlock component
export const FormBlock: React.FC<Props> = ({ enableIntro, form, introContent }) => {
  const { id: formID, confirmationMessage, confirmationType, redirect, submitButtonLabel } = form

  // Initialize form methods
  const formMethods = useForm({
    defaultValues: buildInitialFormState(form.fields),
  })

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = formMethods

  // Define state for loading, submission, and errors
  const [isLoading, setIsLoading] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false)
  const [error, setError] = useState<{ message: string; status?: string } | undefined>()
  const router = useRouter()

  const onSubmit = useCallback(
    async (data: Data) => {
      let loadingTimerID: ReturnType<typeof setTimeout>

      const submitForm = async () => {
        setError(undefined)
        const dataToSend = Object.entries(data).map(([name, value]) => ({
          field: name,
          value,
        }))

        // Validate submission data structure
        if (!formID || !dataToSend.length) {
          setError({ message: 'Invalid form data' })
          return
        }

        // Delay loading indicator by 1 second
        loadingTimerID = setTimeout(() => {
          setIsLoading(true)
        }, 1000)

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
          })

          const res = await req.json()
          clearTimeout(loadingTimerID)

          if (req.status >= 400) {
            setIsLoading(false)
            setError({
              message: res.errors?.[0]?.message || 'Internal Server Error',
              status: res.status,
            })
            return
          }

          setIsLoading(false)
          setHasSubmitted(true)

          if (confirmationType === 'redirect' && redirect) {
            const { url } = redirect
            if (url) router.push(url)
          }
        } catch (_err) {
          setIsLoading(false)
          setError({
            message:
              'Unable to submit form. Please try again or contact support if the problem persists.',
          })
        }
      }

      await submitForm()
    },
    [router, formID, redirect, confirmationType]
  )

  return (
    <div className="container lg:max-w-3xl pb-20">
      <FormProvider {...formMethods}>
        {enableIntro && introContent && !hasSubmitted && (
          <RichText className="mb-8" content={introContent} enableGutter={false} />
        )}
        {isLoading && !hasSubmitted && <p>Loading, please wait...</p>}
        {hasSubmitted && confirmationType === 'message' && (
          <RichText content={confirmationMessage as Record<string, any>} />
        )}
        {error && <div>{`${error.status || '500'}: ${error.message || ''}`}</div>}
        {!hasSubmitted && (
          <form id={formID} onSubmit={handleSubmit(onSubmit)}>
            <div className="mb-4 last:mb-0">
              {form.fields?.map((field, index) => {
                const FieldComponent = fields[field.blockType as keyof typeof fields]

                if (FieldComponent) {
                  const key = field?.id ?? field?.name ?? `field-${index}`
                  return (
                    <div className="mb-6 last:mb-0" key={key}>
                      <FieldComponent {...(field as any)} errors={errors} register={register} />
                    </div>
                  )
                }
                return null
              })}
            </div>
            <Button form={formID} type="submit" variant="default">
              {submitButtonLabel}
            </Button>
          </form>
        )}
      </FormProvider>
    </div>
  )
}
// import type { Form as FormType } from "@revealui/cms/plugins";
// import { useRouter } from "next/navigation";
// import { useForm, FormProvider } from "react-hook-form";
// import RichText from "../../components/RichText";
// import { Button } from "../../components/ui/button";
// import { buildInitialFormState } from "./buildInitialFormState";
// import { fields } from "./fields";

// // Define types for form data
// export type Value = unknown;
// export interface Property {
//   [key: string]: Value;
// }
// export interface Data {
//   [key: string]: Property | Property[];
// }

// // Define the FormBlockType
// export type FormBlockType = {
//   blockName?: string;
//   blockType?: "formBlock";
//   enableIntro: boolean;
//   form: FormType;
//   introContent?: {
//     [k: string]: unknown;
//   }[];
// };

// export type Props = {
//   id?: string & FormBlockType;
// };
// // Define your FormBlock component
// export const FormBlock: React.FC<{ id?: string } & FormBlockType> = (props) => {
//   const {
//     enableIntro,
//     form: formFromProps,
//     form: {
//       id: formID,
//       confirmationMessage,
//       confirmationType,
//       redirect,
//       submitButtonLabel,
//     } = {},
//     introContent,
//   } = props;

//   // Initialize form methods
//   const formMethods = useForm({
//     defaultValues: buildInitialFormState(formFromProps.fields),
//   });
//   const {
//     control,
//     formState: { errors },
//     handleSubmit,
//     register,
//   } = formMethods;

//   // Define state for loading, submission, and errors
//   const [isLoading, setIsLoading] = useState(false);
//   const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
//   const [error, setError] = useState<
//     { message: string; status?: string } | undefined
//   >();
//   const router = useRouter();

//   const onSubmit = useCallback(
//     async (data: Data) => {
//       let loadingTimerID: ReturnType<typeof setTimeout>;

//       const submitForm = async () => {
//         setError(undefined);
//         const dataToSend = Object.entries(data).map(([name, value]) => ({
//           field: name,
//           value,
//         }));

//         // Delay loading indicator by 1 second
//         loadingTimerID = setTimeout(() => {
//           setIsLoading(true);
//         }, 1000);

//         try {
//           const req = await fetch(
//             `${process.env.NEXT_PUBLIC_SERVER_URL}/api/form-submissions`,
//             {
//               body: JSON.stringify({
//                 form: formID,
//                 submissionData: dataToSend,
//               }),
//               headers: {
//                 "Content-Type": "application/json",
//               },
//               method: "POST",
//             },
//           );

//           const res = await req.json();
//           clearTimeout(loadingTimerID);

//           if (req.status >= 400) {
//             setIsLoading(false);
//             setError({
//               message: res.errors?.[0]?.message || "Internal Server Error",
//               status: res.status,
//             });
//             return;
//           }

//           setIsLoading(false);
//           setHasSubmitted(true);

//           if (confirmationType === "redirect" && redirect) {
//             const { url } = redirect;
//             if (url) router.push(url);
//           }
//         } catch (err) {
//           console.warn(err);
//           setIsLoading(false);
//           setError({ message: "Something went wrong." });
//         }
//       };

//       await submitForm();
//     },
//     [router, formID, redirect, confirmationType],
//   );

//   return (
//     <div className="container lg:max-w-3xl pb-20">
//       <FormProvider {...formMethods}>
//         {enableIntro && introContent && !hasSubmitted && (
//           <RichText
//             className="mb-8"
//             content={introContent}
//             enableGutter={false}
//           />
//         )}
//         {isLoading && !hasSubmitted && <p>Loading, please wait...</p>}
//         {hasSubmitted && confirmationType === "message" && (
//           <RichText content={confirmationMessage} />
//         )}
//         {error && (
//           <div>{`${error.status || "500"}: ${error.message || ""}`}</div>
//         )}
//         {!hasSubmitted && (
//           <form id={formID} onSubmit={handleSubmit(onSubmit)}>
//             <div className="mb-4 last:mb-0">
//               {formFromProps?.fields?.map((field, index) => {
//                 // Ensure that fields is typed correctly
//                 const Field: React.FC<any> =
//                   fields[field.blockType as keyof typeof fields]; // Type assertion here

//                 if (Field) {
//                   return (
//                     <div className="mb-6 last:mb-0" key={index}>
//                       <Field
//                         form={formFromProps}
//                         {...field}
//                         {...formMethods}
//                         control={control}
//                         errors={errors}
//                         register={register}
//                       />
//                     </div>
//                   );
//                 }
//                 return null;
//               })}
//             </div>

//             <Button form={formID} type="submit" variant="default">
//               {submitButtonLabel}
//             </Button>
//           </form>
//         )}
//       </FormProvider>
//     </div>
//   );
// };

// /* eslint-disable @typescript-eslint/no-explicit-any */
// "use client";
// import type { Form as FormType } from "@revealui/cms/plugins";

// import { useRouter } from "next/navigation";
// import React, { useCallback, useState } from "react";
// import { useForm, FormProvider } from "react-hook-form";
// import RichText from "../../components/RichText";
// import { Button } from "../../components/ui/button";

// import { buildInitialFormState } from "./buildInitialFormState";
// import { fields } from "./fields";

// export type Value = unknown;

// export interface Property {
//   [key: string]: Value;
// }

// export interface Data {
//   [key: string]: Property | Property[];
// }

// export type FormBlockType = {
//   blockName?: string;
//   blockType?: "formBlock";
//   enableIntro: boolean;
//   form: FormType;
//   introContent?: {
//     [k: string]: unknown;
//   }[];
// };

// export const FormBlock: React.FC<
//   {
//     id?: string;
//   } & FormBlockType
// > = (props) => {
//   const {
//     enableIntro,
//     form: formFromProps,
//     form: {
//       id: formID,
//       confirmationMessage,
//       confirmationType,
//       redirect,
//       submitButtonLabel,
//     } = {},
//     introContent,
//   } = props;

//   const formMethods = useForm({
//     defaultValues: buildInitialFormState(formFromProps.fields),
//   });
//   const {
//     control,
//     formState: { errors },
//     handleSubmit,
//     register,
//   } = formMethods;

//   const [isLoading, setIsLoading] = useState(false);
//   const [hasSubmitted, setHasSubmitted] = useState<boolean>();
//   const [error, setError] = useState<
//     { message: string; status?: string } | undefined
//   >();
//   const router = useRouter();

//   const onSubmit = useCallback(
//     (data: Data) => {
//       let loadingTimerID: ReturnType<typeof setTimeout>;
//       const submitForm = async () => {
//         setError(undefined);

//         const dataToSend = Object.entries(data).map(([name, value]) => ({
//           field: name,
//           value,
//         }));

//         // delay loading indicator by 1s
//         loadingTimerID = setTimeout(() => {
//           setIsLoading(true);
//         }, 1000);

//         try {
//           const req = await fetch(
//             `${process.env.NEXT_PUBLIC_SERVER_URL}/api/form-submissions`,
//             {
//               body: JSON.stringify({
//                 form: formID,
//                 submissionData: dataToSend,
//               }),
//               headers: {
//                 "Content-Type": "application/json",
//               },
//               method: "POST",
//             },
//           );

//           const res = await req.json();

//           clearTimeout(loadingTimerID);

//           if (req.status >= 400) {
//             setIsLoading(false);

//             setError({
//               message: res.errors?.[0]?.message || "Internal Server Error",
//               status: res.status,
//             });

//             return;
//           }

//           setIsLoading(false);
//           setHasSubmitted(true);

//           if (confirmationType === "redirect" && redirect) {
//             const { url } = redirect;

//             const redirectUrl = url;

//             if (redirectUrl) router.push(redirectUrl);
//           }
//         } catch (err) {
//           console.warn(err);
//           setIsLoading(false);
//           setError({
//             message: "Something went wrong.",
//           });
//         }
//       };

//       void submitForm();
//     },
//     [router, formID, redirect, confirmationType],
//   );

//   return (
//     <div className="container lg:max-w-3xl pb-20">
//       <FormProvider {...formMethods}>
//         {enableIntro && introContent && !hasSubmitted && (
//           <RichText
//             className="mb-8"
//             content={introContent}
//             enableGutter={false}
//           />
//         )}
//         {!isLoading && hasSubmitted && confirmationType === "message" && (
//           <RichText content={confirmationMessage} />
//         )}
//         {isLoading && !hasSubmitted && <p>Loading, please wait...</p>}
//         {error && (
//           <div>{`${error.status || "500"}: ${error.message || ""}`}</div>
//         )}
//         {!hasSubmitted && (
//           <form id={formID} onSubmit={handleSubmit(onSubmit)}>
//             <div className="mb-4 last:mb-0">
//               {formFromProps &&
//                 formFromProps.fields &&
//                 formFromProps.fields?.map((field, index) => {
//                   const Field: React.FC<any> = fields?.[field.blockType];
//                   if (Field) {
//                     return (
//                       <div className="mb-6 last:mb-0" key={index}>
//                         <Field
//                           form={formFromProps}
//                           {...field}
//                           {...formMethods}
//                           control={control}
//                           errors={errors}
//                           register={register}
//                         />
//                       </div>
//                     );
//                   }
//                   return null;
//                 })}
//             </div>

//             <Button form={formID} type="submit" variant="default">
//               {submitButtonLabel}
//             </Button>
//           </form>
//         )}
//       </FormProvider>
//     </div>
//   );
// };
