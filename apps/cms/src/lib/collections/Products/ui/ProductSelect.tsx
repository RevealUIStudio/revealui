'use client'

import React from 'react'

// Define a cached function for fetching Stripe products
// const fetchStripeProducts = cache(async () => {
const fetchStripeProducts = async () => {
  const response = await fetch('/api/stripe/products', {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  const data = await response.json()
  if (data?.data) {
    return data.data.reduce(
      (acc: { label: string; value: string }[], item: { name: string; id: string }) => {
        acc.push({
          label: item.name || item.id,
          value: item.id,
        })
        return acc
      },
      [
        {
          label: 'Select a product',
          value: '',
        },
      ],
    )
  }
  return []
}

export const ProductSelect = (props: { name: string; label: string }) => {
  const { label } = props
  const [_options, setOptions] = React.useState<
    {
      label: string
      value: string
    }[]
  >([])

  React.useEffect(() => {
    const initializeOptions = async () => {
      try {
        const fetchedOptions = await fetchStripeProducts()
        setOptions(fetchedOptions)
      } catch (_error) {
        // Error handling: silently fail to load products
        // User will see empty dropdown, can still create product in Stripe dashboard
        setOptions([])
      }
    }

    initializeOptions()
  }, [])

  return (
    <div>
      <p style={{ marginBottom: '0' }}>{typeof label === 'string' ? label : 'Product'}</p>
      <p
        style={{
          marginBottom: '0.75rem',
          color: 'var(--theme-elevation-400)',
        }}
      >
        {`Select the related Stripe product or `}
        <a
          href={`https://dashboard.stripe.com/${
            import.meta.env.VITE_STRIPE_IS_TEST_KEY ? 'test/' : ''
          }products/create`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--theme-text' }}
        >
          create a new one
        </a>
        {'.'}
      </p>
    </div>
  )
}
// // TODO: Implement local UI components
// TODO: Implement local alternative
// import // @revealui/core/fields/Select";
// import { TextField } from "@revealui/core";
// import React from "react";

// export const ProductSelect: React.FC<TextField> = (props) => {
//   const { name, label } = props;
//   const [options, setOptions] = React.useState<
//     {
//       label: string;
//       value: string;
//     }[]
//   >([]);
//   console.log("name", name);
//   // const { value: stripeProductID } = useFormFields(([fields]) => fields[name]);

//   React.useEffect(() => {
//     // const getStripeProducts = async () => {
//     //   const productsFetch = await fetch("/api/stripe/products", {
//     //     credentials: "include",
//     //     headers: {
//     //       "Content-Type": "application/json",
//     //     },
//     //   });

//     const fetchStripeProducts = cache(async () => {
//       const response = await fetch("/api/stripe/products", {
//         credentials: "include",
//         headers: {
//           "Content-Type": "application/json",
//         },
//       });

//       const res = await productsFetch.json();
//       if (res?.data) {
//         const fetchedProducts = res.data?.reduce(
//           (acc: { label: any; value: any }[], item: { name: any; id: any }) => {
//             acc.push({
//               label: item.name || item.id,
//               value: item.id,
//             });
//             return acc;
//           },
//           [
//             {
//               label: "Select a product",
//               value: "",
//             },
//           ],
//         );
//         setOptions(fetchedProducts);
//       }
//     };

//     getStripeProducts();
//   }, []);

//   // const href = `https://dashboard.stripe.com/${
//   //   import.meta.env.VITE_STRIPE_IS_TEST_KEY ? "test/" : ""
//   // }products/${stripeProductID}`;

//   return (
//     <div>
//       <p style={{ marginBottom: "0" }}>
//         {typeof label === "string" ? label : "Product"}
//       </p>
//       <p
//         style={{
//           marginBottom: "0.75rem",
//           color: "var(--theme-elevation-400)",
//         }}
//       >
//         {`Select the related Stripe product or `}
//         <a
//           href={`https://dashboard.stripe.com/${
//             import.meta.env.VITE_STRIPE_IS_TEST_KEY ? "test/" : ""
//           }products/create`}
//           target="_blank"
//           rel="noopener noreferrer"
//           style={{ color: "var(--theme-text" }}
//         >
//           create a new one
//         </a>
//         {"."}
//       </p>
//       <Select {...props} label="" options={options} />
//       {/* {Boolean(stripeProductID) && (
//         <div
//           style={{
//             marginTop: "-1rem",
//             marginBottom: "1.5rem",
//           }}
//         >
//           <div>
//             <span
//               className="label"
//               style={{
//                 color: "#9A9A9A",
//               }}
//             >
//               {`Manage "${
//                 options.find((option) => option.value === stripeProductID)
//                   ?.label || "Unknown"
//               }" in Stripe`}
//             </span>
//             <CopyToClipboard value={href} />
//           </div>
//           <div
//             style={{
//               overflow: "hidden",
//               textOverflow: "ellipsis",
//               fontWeight: "600",
//             }}
//           >
//             <a
//               href={`https://dashboard.stripe.com/${
//                 import.meta.env.VITE_STRIPE_IS_TEST_KEY ? "test/" : ""
//               }products/${stripeProductID}`}
//               target="_blank"
//               rel="noreferrer noopener"
//             >
//               {href}
//             </a>
//           </div>
//         </div>
//       )} */}
//     </div>
//   );
// };
