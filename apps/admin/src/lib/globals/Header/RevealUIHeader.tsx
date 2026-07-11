'use client';

import { RevealUIWordmark } from '@revealui/presentation/server';
import { ButtonLink, PlainButtonLink } from '@/components/revealui/elements';
import {
  NavbarLink,
  NavbarLogo,
  NavbarWithLinksActionsAndCenteredLogo,
} from '@/components/revealui/sections';
import { getLinkLabel, getLinkUrl } from '@/lib/cms/revealui-helpers';
import type { HeaderType } from './Component';

interface RevealUIHeaderProps {
  header: HeaderType;
}

/**
 * RevealUI-themed Header component that maps admin navItems to RevealUI navbar
 */
export function RevealUIHeader({ header }: RevealUIHeaderProps) {
  return (
    <NavbarWithLinksActionsAndCenteredLogo
      links={header.navItems?.map((item, idx) => {
        const href = getLinkUrl(item.link);
        const label = getLinkLabel(item.link);

        // Handle newTab - Next.js Link supports target and rel
        const linkProps = item.link.newTab
          ? { target: '_blank', rel: 'noopener noreferrer' as const }
          : {};

        return (
          <NavbarLink key={item.id || idx} href={href} {...linkProps}>
            {label}
          </NavbarLink>
        );
      })}
      logo={
        <NavbarLogo href="/">
          <RevealUIWordmark className="text-2xl" />
        </NavbarLogo>
      }
      actions={
        <>
          {/* You can customize these action buttons or make them configurable via admin */}
          <PlainButtonLink href="/login" size="md">
            Log in
          </PlainButtonLink>
          <ButtonLink href="/get-started" size="md">
            Get started
          </ButtonLink>
        </>
      }
    />
  );
}
