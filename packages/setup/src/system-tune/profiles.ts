/**
 * Built-in Tuning Profiles
 *
 * Profiles are ordered by specificity — the first match wins.
 * Add new profiles here, most specific first.
 */

// Seed profile: the exact 2026-04-13 WSL fix
import wslLowRam from './profiles/wsl-low-ram.json' with { type: 'json' };
import type { TuneProfile } from './types.js';

export const PROFILES: TuneProfile[] = [wslLowRam as TuneProfile];
