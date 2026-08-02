// console-allowed
/**
 * Mutable claim-gates scan state (shared across claim-drift modules).
 */
import path from 'node:path';
import { type ClaimProfile, existingRoots, getProfile, resolveProfile } from '../profiles.js';
import type { ClaimProfileName } from '../types.js';

export interface ClaimScanState {
  Root: string;
  showFix: boolean;
  ActiveProfile: ClaimProfile;
  WarnOnly: boolean;
  rootPredicateCache: ((fullPath: string) => boolean) | undefined;
}

export const scanState: ClaimScanState = {
  Root: '',
  showFix: false,
  ActiveProfile: getProfile('product-runtime'),
  WarnOnly: false,
  rootPredicateCache: undefined,
};

export function configureClaimGatesRoot(root: string, profileName?: ClaimProfileName): void {
  scanState.Root = path.resolve(root);
  scanState.rootPredicateCache = undefined;
  scanState.ActiveProfile = getProfile(resolveProfile(scanState.Root, profileName));
}

export function getClaimGatesRoot(): string {
  return scanState.Root;
}

export function resolvedScanDirs(): string[] {
  const candidates = scanState.ActiveProfile.scanDirs;
  return scanState.ActiveProfile.softScanDirs
    ? existingRoots(scanState.Root, candidates)
    : [...candidates];
}

export function resolvedLicenseRoots(): string[] {
  const candidates = scanState.ActiveProfile.licenseScanRoots;
  return scanState.ActiveProfile.softScanDirs
    ? existingRoots(scanState.Root, candidates)
    : [...candidates];
}

export function resolvedFutureTenseFiles(): string[] {
  return existingRoots(scanState.Root, scanState.ActiveProfile.futureTenseFiles);
}

export function resolvedAspirationalPaths(): string[] {
  const candidates = scanState.ActiveProfile.aspirationalPaths;
  return scanState.ActiveProfile.softScanDirs
    ? existingRoots(scanState.Root, candidates)
    : [...candidates];
}

export function resolvedCopyDependentPaths(): string[] {
  const candidates = scanState.ActiveProfile.copyDependentPaths;
  return scanState.ActiveProfile.softScanDirs
    ? existingRoots(scanState.Root, candidates)
    : [...candidates];
}

export function resolvedFleetAttributionFiles(): string[] {
  const candidates = scanState.ActiveProfile.fleetAttributionFiles;
  return scanState.ActiveProfile.softScanDirs
    ? existingRoots(scanState.Root, candidates)
    : [...candidates];
}
