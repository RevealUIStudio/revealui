/* eslint-disable @typescript-eslint/no-explicit-any */
// import { LabelFunction } from "@revealui/cms";
// import { TextField } from "@revealui/cms";
// import React from "react";

import { TextField } from "@revealui/cms";
import React from "react";

// // const fetchFighters = cache(async (FighterID: any) => {
// const fetchFighters = async (FighterID: any) => {
//   const response = await fetch(`/api/users/${FighterID}`, {
//     credentials: "include",
//     headers: {
//       "Content-Type": "application/json",
//     },
//   });
//   if (!response.ok) {
//     throw new Error(`HTTP error! status: ${response.status}`);
//   }
//   return response.json();
// };

export const FighterSelect: React.FC<TextField> = (props) => {
	const { name, label } = props;
	const [options, setOptions] = React.useState<
		{
			label: string;
			value: string;
		}[]
	>([]);

	React.useEffect(() => {
		const initializeFighters = async () => {
			try {
				const fetchFighters = async (FighterID: string) => {
					// Stub function - returns empty data for now
					return { data: [] };
				};
				const FighterID = "60f3b3b3b3b3b3b3b3b3b3b3";
				const res = await fetchFighters(FighterID);
				if (
					res &&
					typeof res === "object" &&
					"data" in res &&
					Array.isArray(res.data)
				) {
					const fetchedFighters = res.data.reduce(
						(
							acc: { label: string; value: string }[],
							item: { name: string; email: string; id: string },
						) => {
							acc.push({
								label: item.name || item.email || item.id,
								value: item.id,
							});
							return acc;
						},
						[{ label: "Select a Fighter", value: "" }],
					);
					setOptions(fetchedFighters);
				}
			} catch (error) {
				// Error fetching fighters - silently fail
				// Component will render with empty options
			}
		};

		initializeFighters();
	}, []);
	const labelString =
		typeof label === "function"
			? (label as LabelFunction)({ t: () => "", i18n: {} as any })
			: String(label);
	const optionsMap = options.map((option) => (
		<p key={option.value}>{option.label}</p>
	));
	const title = "FighterSelect";
	return (
		<div>
			<h1>{title}</h1>
			<p>{name}</p>

			<p>{labelString}</p>
			<p>{optionsMap}</p>
		</div>
	);
};
//   const FighterID = "60f3b3b3b3b3b3b3b3b3b3b3";
//   React.useEffect(() => {
//     const getFighters = async () => {
//       try {
//         const FightersFetch = await fetch(`/api/users/${FighterID}`, {
//           credentials: "include",
//           headers: {
//             "Content-Type": "application/json",
//           },
//         });

//         const res = await FightersFetch.json();

//         if (res?.data && Array.isArray(res.data)) {
//           const fetchedFighters = res.data?.reduce(
//             (
//               acc: { label: any; value: any }[],
//               item: { name: any; email: any; id: any },
//             ) => {
//               acc.push({
//                 label: item.name || item.email || item.id,
//                 value: item.id,
//               });
//               return acc;
//             },
//             [
//               {
//                 label: "Select a Fighter",
//                 value: "",
//               },
//             ],
//           );
//           setOptions(fetchedFighters);
//         }
//       } catch (error) {
//         console.error(error);
//       }
//     };

//     getFighters();
//   }, []);
//   // }, [FighterID]);

//   // const href = `https://localhost:3000/${
//   //   import.meta.env.NEXT_PRIVATE_REVALIDATION_KEY ? "auth/" : ""
//   // }users/${FighterID}`;

//   return (
//     <div>
//       <p style={{ marginBottom: "0" }}>
//         {typeof label === "string" ? label : "Fighter"}
//       </p>
//       <p
//         style={{
//           marginBottom: "0.75rem",
//           color: "var(--theme-elevation-400)",
//         }}
//       >
//         {`Select the related Stripe Fighter or `}
//         <a
//           href={`http://localhost:3000/${
//             import.meta.env.NEXT_PRIVATE_REVALIDATION_KEY ? "auth/" : ""
//           }users/create`}
//           target="_blank"
//           rel="noopener noreferrer"
//           style={{ color: "var(--theme-text" }}
//         >
//           create a new one
//         </a>
//         {"."}
//       </p>
//       {/* <Select {...props} label="" options={options} />
//       {Boolean(FighterID) && (
//         <div>
//           <div>
//             <span
//               className="label"
//               style={{
//                 color: "#9A9A9A",
//               }}
//             >
//               {`Manage "${
//                 options.find((option) => option.value === FighterID)?.label ||
//                 "Unknown"
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
//               href={`http://localhost:3000/${
//                 import.meta.env.NEXT_PRIVATE_REVALIDATION_KEY ? "auth/" : ""
//               }fighters/${FighterID}`}
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
