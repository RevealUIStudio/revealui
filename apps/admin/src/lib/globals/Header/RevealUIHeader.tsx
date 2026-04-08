'use client';

import Image from 'next/image';
import { ButtonLink, PlainButtonLink } from '@/components/revealui/elements';
import {
  NavbarLink,
  NavbarLogo,
  NavbarWithLinksActionsAndCenteredLogo,
} from '@/components/revealui/sections';
import { getLinkLabel, getLinkUrl } from '@/lib/utilities/revealui-helpers';
import type { HeaderType } from './Component';

interface RevealUIHeaderProps {
  header: HeaderType;
}

/**
 * RevealUI-themed Header component that maps CMS navItems to RevealUI navbar
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
          {/* Use existing Logo component, but adapt for navbar size */}
          <div className="flex items-center">
            <Image
              src="/revealui-logo.svg"
              alt="RevealUI Logo"
              width={113}
              height={28}
              className="h-7 w-auto dark:invert"
              priority
            />
          </div>
        </NavbarLogo>
      }
      actions={
        <>
          {/* You can customize these action buttons or make them configurable via CMS */}
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
