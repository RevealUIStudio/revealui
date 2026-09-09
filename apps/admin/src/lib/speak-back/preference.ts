import { getSpeakBackConfig } from './config';

export function readSpeakBackEnabled(): boolean {
  const { preferenceKey, defaultEnabled } = getSpeakBackConfig();
  try {
    const stored = localStorage.getItem(preferenceKey);
    if (stored === 'on') return true;
    if (stored === 'off') return false;
    return defaultEnabled;
  } catch {
    return defaultEnabled;
  }
}

export function writeSpeakBackEnabled(enabled: boolean): void {
  const { preferenceKey } = getSpeakBackConfig();
  try {
    localStorage.setItem(preferenceKey, enabled ? 'on' : 'off');
  } catch {
    // localStorage unavailable — keep in-memory only
  }
}
