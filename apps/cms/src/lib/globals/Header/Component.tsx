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
  const header: HeaderType = await getCachedGlobal(
    "header" as keyof Config["globals"],
    1,
  )();

  return <HeaderClient header={header} />;
}
