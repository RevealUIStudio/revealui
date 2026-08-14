'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type CookieConsentConfig,
  CookieConsentManager,
  DENIED_OPTIONAL_CONSENT,
} from './consent.js';

export interface CookieConsentContextValue {
  consent: CookieConsentConfig;
  decided: boolean;
  preferencesOpen: boolean;
  allowOptionalCookies: boolean;
  policyHref: string;
  privacyHref: string;
  acceptAll: () => void;
  rejectAll: () => void;
  setConsent: (next: Partial<CookieConsentConfig>) => void;
  openPreferences: () => void;
  closePreferences: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export interface CookieConsentProviderProps {
  children: ReactNode;
  /**
   * When false (HIPAA profile), optional categories are not offered and a
   * reject-optional decision is recorded so telemetry stays off.
   */
  allowOptionalCookies?: boolean;
  policyHref?: string;
  privacyHref?: string;
  manager?: CookieConsentManager;
}

export function CookieConsentProvider({
  children,
  allowOptionalCookies = true,
  policyHref = '/cookies',
  privacyHref = '/privacy',
  manager,
}: CookieConsentProviderProps): ReactNode {
  const instanceRef = useRef(manager ?? new CookieConsentManager());
  const instance = instanceRef.current;
  const [consent, setConsentState] = useState<CookieConsentConfig>(() => instance.getConsent());
  const [decided, setDecided] = useState(() => instance.hasDecision());
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    return instance.subscribe(() => {
      setConsentState(instance.getConsent());
      setDecided(instance.hasDecision());
    });
  }, [instance]);

  const acceptAll = useCallback(() => {
    if (!allowOptionalCookies) {
      instance.rejectAll();
      return;
    }
    instance.acceptAll();
    setPreferencesOpen(false);
  }, [allowOptionalCookies, instance]);

  const rejectAll = useCallback(() => {
    instance.rejectAll();
    setPreferencesOpen(false);
  }, [instance]);

  const setConsent = useCallback(
    (next: Partial<CookieConsentConfig>) => {
      if (!allowOptionalCookies) {
        instance.rejectAll();
        return;
      }
      instance.setConsent(next);
    },
    [allowOptionalCookies, instance],
  );

  const openPreferences = useCallback(() => {
    setPreferencesOpen(true);
  }, []);

  const closePreferences = useCallback(() => {
    setPreferencesOpen(false);
  }, []);

  const value = useMemo<CookieConsentContextValue>(
    () => ({
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
    }),
    [
      acceptAll,
      allowOptionalCookies,
      closePreferences,
      consent,
      decided,
      openPreferences,
      policyHref,
      privacyHref,
      preferencesOpen,
      rejectAll,
      setConsent,
    ],
  );

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
}

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error('useCookieConsent must be used within CookieConsentProvider');
  }
  return ctx;
}

/** Safe outside the provider: deny optional categories. */
export function useOptionalCookieConsent(): CookieConsentContextValue | null {
  return useContext(CookieConsentContext);
}

export function hasGrantedAnalytics(consent: CookieConsentConfig | null | undefined): boolean {
  return consent?.analytics === true;
}

export { DENIED_OPTIONAL_CONSENT };
