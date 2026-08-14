'use client';

import { type ReactNode, useId, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '../components/Button.js';
import { Description, Label } from '../components/fieldset.js';
import { Switch, SwitchField } from '../components/switch.js';
import { Text, TextLink } from '../components/text.js';
import { cn } from '../utils/cn.js';
import type { CookieConsentConfig } from './consent.js';
import { useCookieConsent, useOptionalCookieConsent } from './provider.js';

const CATEGORIES: readonly {
  key: keyof CookieConsentConfig;
  label: string;
  description: string;
  locked?: boolean;
}[] = [
  {
    key: 'necessary',
    label: 'Necessary',
    description: 'Sign-in, security, and remembering this choice. Always on.',
    locked: true,
  },
  {
    key: 'functional',
    label: 'Functional',
    description: 'Optional extras that remember preferences beyond sign-in.',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'Anonymous performance and product measurement. Off until you accept.',
  },
  {
    key: 'marketing',
    label: 'Marketing',
    description: 'Advertising or remarketing. We do not use these today.',
  },
];

export interface CookieConsentBannerProps {
  className?: string;
}

export function CookieConsentBanner({ className }: CookieConsentBannerProps): ReactNode {
  const {
    consent,
    decided,
    preferencesOpen,
    allowOptionalCookies,
    policyHref,
    privacyHref,
    acceptAll,
    rejectAll,
    setConsent,
    openPreferences,
    closePreferences,
  } = useCookieConsent();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<CookieConsentConfig>(consent);

  const showBanner = !decided || preferencesOpen;
  const showCustomize = allowOptionalCookies && (preferencesOpen || decided);

  useLayoutEffect(() => {
    if (!showBanner) {
      return;
    }
    const root = document.documentElement;
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const applyPad = () => {
      root.style.paddingBottom = `${panel.offsetHeight}px`;
    };
    applyPad();
    if (typeof ResizeObserver === 'undefined') {
      return () => {
        root.style.paddingBottom = '';
      };
    }
    const observer = new ResizeObserver(applyPad);
    observer.observe(panel);
    return () => {
      observer.disconnect();
      root.style.paddingBottom = '';
    };
  }, [showBanner]);

  if (!showBanner) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 max-h-[min(42vh,22rem)] overflow-y-auto border-t border-border bg-background/95 p-3 shadow-lg backdrop-blur-sm sm:p-6',
        className,
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="space-y-2">
          <h2 id={titleId} className="text-base font-semibold text-foreground">
            {allowOptionalCookies ? 'Cookies' : 'Necessary cookies only'}
          </h2>
          <Text className="text-sm text-muted-foreground">
            {allowOptionalCookies
              ? 'We use necessary cookies to run the site. Optional analytics stay off until you accept. Reject all is always available.'
              : 'This deployment is in a HIPAA configuration. Only necessary cookies run. Third-party analytics and session replay stay off.'}{' '}
            <TextLink href={policyHref}>Cookie policy</TextLink>
            {' · '}
            <TextLink href={privacyHref}>Privacy</TextLink>
          </Text>
        </div>

        {showCustomize ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {CATEGORIES.map((category) => (
              <SwitchField key={category.key}>
                <Label>{category.label}</Label>
                <Description>{category.description}</Description>
                <Switch
                  checked={category.locked ? true : draft[category.key]}
                  disabled={category.locked}
                  onChange={(checked) => {
                    if (category.locked) {
                      return;
                    }
                    setDraft((current) => ({ ...current, [category.key]: checked }));
                  }}
                  aria-label={category.label}
                />
              </SwitchField>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button type="button" variant="brand" appearance="solid" onClick={acceptAll}>
            {allowOptionalCookies ? 'Accept all' : 'OK'}
          </Button>
          {allowOptionalCookies ? (
            <>
              <Button type="button" variant="neutral" appearance="outline" onClick={rejectAll}>
                Reject all
              </Button>
              {showCustomize ? (
                <Button
                  type="button"
                  variant="neutral"
                  appearance="ghost"
                  onClick={() => {
                    setConsent({
                      functional: draft.functional,
                      analytics: draft.analytics,
                      marketing: draft.marketing,
                    });
                    closePreferences();
                  }}
                >
                  Save choices
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="neutral"
                  appearance="ghost"
                  onClick={() => {
                    setDraft(consent);
                    openPreferences();
                  }}
                >
                  Customize
                </Button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CookieSettingsButton({
  className,
  children = 'Cookie settings',
}: {
  className?: string;
  children?: string;
}): ReactNode {
  const ctx = useOptionalCookieConsent();
  if (!ctx) {
    return null;
  }
  return (
    <button type="button" className={className} onClick={ctx.openPreferences}>
      {children}
    </button>
  );
}
