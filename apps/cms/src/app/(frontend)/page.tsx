import PageTemplate, { generateMetadata } from "./[slug]/page";

// Force dynamic rendering to prevent build-time database access
export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default PageTemplate;

export { generateMetadata };
