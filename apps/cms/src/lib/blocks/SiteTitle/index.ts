import { Block } from "payload";

export const SiteTitle: Block = {
  slug: "siteTitle",
  interfaceName: "SiteTitle",
  fields: [
    { name: "siteName", type: "text", required: true, admin: { width: "50%" } },
  ],
};
