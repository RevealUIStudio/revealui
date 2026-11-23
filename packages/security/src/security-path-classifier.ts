import securityPathData from './security-paths.shared.json' with { type: 'json' };

export const MAX_CLASSIFIABLE_SECURITY_PATHS = 3000;

if (
  !(securityPathData && Array.isArray(securityPathData.markers)) ||
  securityPathData.markers.length === 0 ||
  securityPathData.markers.some((marker) => typeof marker !== 'string' || marker.length === 0)
)
  throw new Error('security path markers are malformed');

export const SECURITY_PATH_CLASSIFIER_VERSION = 'shared-security-paths-v1';
export const SECURITY_PATH_MARKERS: readonly string[] = Object.freeze([
  ...securityPathData.markers,
]);

/** Classify every path, including both sides of a rename, against the canonical shared markers. */
export function classifySecurityPaths(paths: readonly string[]): string[] {
  const hits: string[] = [];
  for (const path of paths) {
    if (typeof path !== 'string' || path.length === 0)
      throw new Error('security path classifier received an invalid path');
    if (SECURITY_PATH_MARKERS.some((marker) => path.includes(marker))) hits.push(path);
  }
  return hits;
}

/** Fail closed when GitHub's changed-file endpoint reaches its documented ceiling. */
export function classifySecurityPathsAtApiLimit(
  paths: readonly string[],
  sourceFileCount = paths.length,
): string[] {
  if (!Number.isSafeInteger(sourceFileCount) || sourceFileCount < 0)
    return ['(file list count is invalid — unclassifiable, failing closed)'];
  if (sourceFileCount >= MAX_CLASSIFIABLE_SECURITY_PATHS)
    return ['(file list at the API ceiling — unclassifiable, failing closed)'];
  return classifySecurityPaths(paths);
}
