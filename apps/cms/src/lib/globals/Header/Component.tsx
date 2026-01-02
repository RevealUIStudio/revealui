import { Page } from "@/types";
import { getCachedGlobal } from "../../utilities/getGlobals";
import { HeaderClient } from "./Component.client";

import React from "react";
import { Config } from "@revealui/cms";

export interface HeaderType {
  id: string;
  navItems?:
    | {
        link: {
          type?: ("reference" | "custom") | null;
          newTab?: boolean | null;
          reference?: {
            relationTo: "pages";
            value: string | Page;
          } | null;
          url?: string | null;
          label: string;
        };
        id?: string | null;
      }[]
    | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

export async function Header() {
  const header = await getCachedGlobal(
    "header",
    1,
  )() as HeaderType | null;

  if (!header) return null;

  return <HeaderClient header={header} />;
}
