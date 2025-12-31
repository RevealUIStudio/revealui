"use client";

import React from "react";
import { CMSLink } from "../../../components/Link";
import { HeaderType } from "../Component";

export const HeaderNav: React.FC<{ header: HeaderType }> = ({ header }) => {
  const navItems = header?.navItems || [];

  return (
    <nav className="flex gap-3 items-center">
      {navItems.map(({ link }, i) => {
        return <CMSLink key={i} {...link} appearance="link" />;
      })}
    </nav>
  );
};
