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

const SCRIPTS_GLOB_PREFIX = 'scripts/**/';

function frozenMarkers(value: unknown, label: string): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((marker) => typeof marker !== 'string' || marker.length === 0)
  )
    throw new Error(`${label} are malformed`);
  return Object.freeze([...value]);
}

/** Paths a receipt alone must not clear. Independent review is required with the receipt, unless the owner SSHSIG clears them. */
export const SENSITIVE_PATH_MARKERS: readonly string[] = frozenMarkers(
  securityPathData.sensitiveMarkers,
  'sensitive path markers',
);

/** Controller source, schema, migrations, and deploy config. A receipt never clears these. */
export const CONTROLLER_PATH_MARKERS: readonly string[] = frozenMarkers(
  securityPathData.controllerMarkers,
  'controller path markers',
);

const CONTROLLER_MIGRATION_ROOTS: readonly string[] = frozenMarkers(
  securityPathData.controllerMigrationRoots,
  'controller migration roots',
);

const controllerMigrationToken = securityPathData.controllerMigrationToken;
if (typeof controllerMigrationToken !== 'string' || controllerMigrationToken.length === 0)
  throw new Error('controller migration token is malformed');
export const CONTROLLER_MIGRATION_TOKEN: string = controllerMigrationToken;

function isControllerMigration(path: string): boolean {
  return (
    CONTROLLER_MIGRATION_ROOTS.some((root) => path.startsWith(root)) &&
    path.includes(CONTROLLER_MIGRATION_TOKEN)
  );
}

function markerMatchesPath(path: string, marker: string): boolean {
  if (marker.startsWith(SCRIPTS_GLOB_PREFIX)) {
    const name = marker.slice(SCRIPTS_GLOB_PREFIX.length);
    if (name.length === 0 || name.includes('/')) return false;
    return path.startsWith('scripts/') && (path === `scripts/${name}` || path.endsWith(`/${name}`));
  }
  return path.includes(marker);
}

function classifyAgainst(paths: readonly string[], markers: readonly string[]): string[] {
  const hits: string[] = [];
  for (const path of paths) {
    if (typeof path !== 'string' || path.length === 0)
      throw new Error('security path classifier received an invalid path');
    if (markers.some((marker) => markerMatchesPath(path, marker))) hits.push(path);
  }
  return hits;
}

/** Classify every path, including both sides of a rename, against the canonical shared markers. */
export function classifySecurityPaths(paths: readonly string[]): string[] {
  return classifyAgainst(paths, SECURITY_PATH_MARKERS);
}

/** Sensitive admission class. Receipt alone does not clear these paths. */
export function classifySensitivePaths(paths: readonly string[]): string[] {
  return classifyAgainst(paths, SENSITIVE_PATH_MARKERS);
}

/** Controller admission class. There is no receipt grant for these paths. */
export function classifyControllerPaths(paths: readonly string[]): string[] {
  const hits = classifyAgainst(paths, CONTROLLER_PATH_MARKERS);
  for (const path of paths) {
    if (typeof path !== 'string' || path.length === 0)
      throw new Error('security path classifier received an invalid path');
    if (isControllerMigration(path) && !hits.includes(path)) hits.push(path);
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
