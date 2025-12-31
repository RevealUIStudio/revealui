/**
 * Type declarations for @payloadcms/next subpath exports
 * This helps TypeScript resolve the package.json exports
 */

declare module "@payloadcms/next/utilities" {
	export {
		getPayload,
		getPayloadHMR,
	} from "@payloadcms/next/dist/exports/utilities";
}

declare module "@payloadcms/next/views" {
	export {
		generatePageMetadata,
		NotFoundPage,
		RootPage,
	} from "@payloadcms/next/dist/exports/views";
}

declare module "@payloadcms/next/routes" {
	export {
		REST_DELETE,
		REST_GET,
		REST_OPTIONS,
		REST_PATCH,
		REST_POST,
	} from "@payloadcms/next/dist/exports/routes";
}

declare module "@payloadcms/next/layouts" {
	export { RootLayout } from "@payloadcms/next/dist/exports/layouts";
}
