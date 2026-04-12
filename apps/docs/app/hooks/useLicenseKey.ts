import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'revealui_license_key';
const API_ENDPOINT = 'https://api.revealui.com/api/license/verify';

export interface LicenseInfo {
  key: string;
  tier: string;
  isValid: boolean;
}

export interface UseLicenseKeyResult {
  key: string | null;
  tier: string | null;
  isValid: boolean;
  isLoading: boolean;
  validate: (key: string) => Promise<{ valid: boolean; tier: string | null }>;
  clear: () => void;
}

export function useLicenseKey(): UseLicenseKeyResult {
  const [key, setKey] = useState<string | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const revalidate = useCallback(async (storedKey: string) => {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: storedKey }),
      });

      if (!response.ok) {
        sessionStorage.removeItem(STORAGE_KEY);
        setKey(null);
        setTier(null);
        setIsValid(false);
        return;
      }

      const data = (await response.json()) as { valid: boolean; tier?: string };
      const valid =
        data.valid && (data.tier === 'pro' || data.tier === 'max' || data.tier === 'enterprise');

      if (valid) {
        setKey(storedKey);
        setTier(data.tier ?? null);
        setIsValid(true);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
        setKey(null);
        setTier(null);
        setIsValid(false);
      }
    } catch {
      // Network error  -  keep the stored key but mark as invalid until next check
      setKey(storedKey);
      setTier(null);
      setIsValid(false);
    }
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      void revalidate(stored).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [revalidate]);

  const validate = useCallback(
    async (inputKey: string): Promise<{ valid: boolean; tier: string | null }> => {
      setIsLoading(true);
      try {
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseKey: inputKey }),
        });

        if (!response.ok) {
          setIsValid(false);
          setKey(null);
          setTier(null);
          return { valid: false, tier: null };
        }

        const data = (await response.json()) as { valid: boolean; tier?: string };
        const valid =
          data.valid && (data.tier === 'pro' || data.tier === 'max' || data.tier === 'enterprise');
        const resolvedTier = data.tier ?? null;

        if (valid) {
          sessionStorage.setItem(STORAGE_KEY, inputKey);
          setKey(inputKey);
          setTier(resolvedTier);
          setIsValid(true);
        } else {
          setIsValid(false);
          setKey(null);
          setTier(null);
        }

        return { valid, tier: resolvedTier };
      } catch {
        setIsValid(false);
        return { valid: false, tier: null };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const clear = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setKey(null);
    setTier(null);
    setIsValid(false);
  }, []);

  return { key, tier, isValid, isLoading, validate, clear };
}
