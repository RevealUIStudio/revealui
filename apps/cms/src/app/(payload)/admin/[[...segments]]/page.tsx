import config from "@payload-config";
import { RootPage } from "@payloadcms/next/views";
import { importMap } from "../importMap";

// Force dynamic rendering to prevent build-time initialization
export const dynamic = "force-dynamic";
export const dynamicParams = true;

type Args = {
	params: Promise<{
		segments: string[];
	}>;
	searchParams: Promise<{
		[key: string]: string | string[];
	}>;
};

// RootPage expects params and searchParams as Promises in Next.js 16
const Page = ({ params, searchParams }: Args) => {
	return RootPage({
		config,
		params,
		searchParams,
		importMap,
	});
};

export default Page;

// /* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
// import config from "@payload-config";
// /* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
// import { RootPage } from "@payloadcms/next/views";
// import { importMap } from "../importMap";

// type Args = {
//   params: {
//     segments: string[];
//   };
//   searchParams: {
//     [key: string]: string | string[];
//   };
// };

// const Page = ({ params, searchParams }: Args) =>
//   RootPage({ config, params, searchParams, importMap });

// export default Page;
