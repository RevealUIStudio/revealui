#!/usr/bin/env tsx
/**
 * Railway marketplace template wiring (GAP-430).
 *
 * The public Deploy Now listing (https://railway.com/deploy/revealui) stores
 * per-service build settings in Railway's template serializedConfig — not in
 * `deployment/railway/api.json` / `admin.json`. Those Config-as-Code files
 * are still the intended builder settings, but new Railway services cannot
 * opt into Config as Code, so a marketplace deploy from repo root falls
 * through to Railpack and fails with "No start command detected."
 *
 * This gate locks the committed marketplace SoT so api + admin always carry
 * an explicit Dockerfile path (and matching `RAILWAY_DOCKERFILE_PATH`) or an
 * explicit start command. Owner republish is still required for the live
 * listing; this file is what Joshua copies into the dashboard.
 *
 * Usage:
 *   pnpm validate:railway-marketplace
 *
 * Exit codes:
 *   0 = committed template cannot Railpack-fail for missing start
 *   1 = missing file, parse error, or api/admin still Railpack-shaped
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');

export const MARKETPLACE_TEMPLATE_REL = 'deployment/railway/marketplace-template.json';
export const API_CAC_REL = 'deployment/railway/api.json';
export const ADMIN_CAC_REL = 'deployment/railway/admin.json';
export const README_REL = 'deployment/railway/README.md';
export const OWNER_PUBLISH_REL = 'docs/distribution/RAILWAY-MARKETPLACE-OWNER-PUBLISH.md';

export const API_DOCKERFILE = 'apps/server/Dockerfile';
export const ADMIN_DOCKERFILE = 'apps/admin/Dockerfile';

export const RAILWAY_DOCKERFILE_PATH_VAR = 'RAILWAY_DOCKERFILE_PATH';
export const UNLICENSED_FLAG_VAR = 'REVEALUI_ALLOW_UNLICENSED_SELF_HOST';

export interface RailwayBuildConfig {
  readonly builder?: string | null;
  readonly dockerfilePath?: string | null;
}

export interface RailwayDeployConfig {
  readonly startCommand?: string | null;
  readonly healthcheckPath?: string | null;
  readonly restartPolicyType?: string | null;
}

export interface RailwayTemplateVariable {
  readonly defaultValue?: string;
}

export interface RailwayMarketplaceGitSource {
  readonly repo?: string;
  readonly rootDirectory?: string | null;
}

export interface RailwayMarketplaceImageSource {
  readonly image?: string;
}

export interface RailwayMarketplaceService {
  readonly name?: string;
  readonly build?: RailwayBuildConfig;
  readonly deploy?: RailwayDeployConfig;
  readonly source?: RailwayMarketplaceGitSource & RailwayMarketplaceImageSource;
  readonly variables?: Record<string, RailwayTemplateVariable>;
}

export interface RailwayMarketplaceTemplate {
  readonly templateId: string;
  readonly slug: string;
  readonly listingUrl: string;
  readonly manifestUrl: string;
  readonly upstreamRepo: string;
  readonly role: string;
  readonly studioProduction: boolean;
  readonly freeOssUnlicensed: boolean;
  readonly ownerRepublishRequired: boolean;
  readonly services: Record<string, RailwayMarketplaceService>;
}

export interface RailwayCacFile {
  readonly build?: RailwayBuildConfig;
  readonly deploy?: RailwayDeployConfig;
}

export function readJsonFile<T>(absPath: string): T {
  return JSON.parse(fs.readFileSync(absPath, 'utf8')) as T;
}

export function loadMarketplaceTemplate(repoRoot: string = ROOT): RailwayMarketplaceTemplate {
  return readJsonFile<RailwayMarketplaceTemplate>(path.join(repoRoot, MARKETPLACE_TEMPLATE_REL));
}

export function loadCacFile(repoRoot: string, relPath: string): RailwayCacFile {
  return readJsonFile<RailwayCacFile>(path.join(repoRoot, relPath));
}

export function variableDefault(
  service: RailwayMarketplaceService,
  key: string,
): string | undefined {
  const value = service.variables?.[key]?.defaultValue;
  return typeof value === 'string' ? value.trim() : undefined;
}

/**
 * True when a git-sourced service cannot hit Railpack "No start command
 * detected." Either an explicit Dockerfile (builder + path, or
 * RAILWAY_DOCKERFILE_PATH) or an explicit start command is enough.
 */
export function gitServiceAvoidsRailpackNoStart(service: RailwayMarketplaceService): boolean {
  const dockerfilePath = service.build?.dockerfilePath?.trim();
  const builder = service.build?.builder;
  const railwayDockerfilePath = variableDefault(service, RAILWAY_DOCKERFILE_PATH_VAR);
  const startCommand = service.deploy?.startCommand?.trim();

  const hasNamedDockerfile =
    builder === 'DOCKERFILE' && typeof dockerfilePath === 'string' && dockerfilePath.length > 0;
  const hasRailwayDockerfilePath =
    typeof railwayDockerfilePath === 'string' && railwayDockerfilePath.length > 0;
  const hasStart = typeof startCommand === 'string' && startCommand.length > 0;

  return hasNamedDockerfile || hasRailwayDockerfilePath || hasStart;
}

export interface ServiceWiringIssue {
  readonly serviceName: string;
  readonly message: string;
}

export function findGitServiceWiringIssues(
  template: RailwayMarketplaceTemplate,
  expected: Readonly<Record<string, string>>,
): ServiceWiringIssue[] {
  const issues: ServiceWiringIssue[] = [];

  for (const [serviceName, dockerfilePath] of Object.entries(expected)) {
    const service = template.services[serviceName];
    if (!service) {
      issues.push({ serviceName, message: 'missing from marketplace-template.json services' });
      continue;
    }
    if (!gitServiceAvoidsRailpackNoStart(service)) {
      issues.push({
        serviceName,
        message:
          'Railpack-shaped: no DOCKERFILE builder+path, no RAILWAY_DOCKERFILE_PATH, no startCommand',
      });
    }
    if (service.build?.builder !== 'DOCKERFILE') {
      issues.push({
        serviceName,
        message: `build.builder must be DOCKERFILE (got ${String(service.build?.builder)})`,
      });
    }
    if (service.build?.dockerfilePath !== dockerfilePath) {
      issues.push({
        serviceName,
        message: `build.dockerfilePath must be ${dockerfilePath} (got ${String(service.build?.dockerfilePath)})`,
      });
    }
    if (variableDefault(service, RAILWAY_DOCKERFILE_PATH_VAR) !== dockerfilePath) {
      issues.push({
        serviceName,
        message: `${RAILWAY_DOCKERFILE_PATH_VAR} must default to ${dockerfilePath}`,
      });
    }
    if (variableDefault(service, UNLICENSED_FLAG_VAR) !== 'true') {
      issues.push({
        serviceName,
        message: `${UNLICENSED_FLAG_VAR} must default to true (Free OSS unlicensed path)`,
      });
    }
  }

  return issues;
}

export function cacDockerfilePath(cac: RailwayCacFile): string | undefined {
  const pathValue = cac.build?.dockerfilePath?.trim();
  return pathValue && pathValue.length > 0 ? pathValue : undefined;
}

export interface DocPhraseCheck {
  readonly relPath: string;
  readonly missing: string[];
}

export const REQUIRED_DOC_PHRASES = [
  'RAILWAY_DOCKERFILE_PATH',
  'republish',
  'manifest.json',
  'No start command',
] as const;

export function findMissingDocPhrases(text: string, phrases: readonly string[]): string[] {
  return phrases.filter((phrase) => !text.includes(phrase));
}

export function checkOwnerDocs(repoRoot: string = ROOT): DocPhraseCheck[] {
  return [README_REL, OWNER_PUBLISH_REL].map((relPath) => ({
    relPath,
    missing: findMissingDocPhrases(
      fs.readFileSync(path.join(repoRoot, relPath), 'utf8'),
      REQUIRED_DOC_PHRASES,
    ),
  }));
}

export function collectIssues(repoRoot: string = ROOT): string[] {
  const issues: string[] = [];
  const templatePath = path.join(repoRoot, MARKETPLACE_TEMPLATE_REL);
  if (!fs.existsSync(templatePath)) {
    issues.push(`missing ${MARKETPLACE_TEMPLATE_REL}`);
    return issues;
  }

  const template = loadMarketplaceTemplate(repoRoot);
  if (template.studioProduction !== false) {
    issues.push('studioProduction must be false (customer marketplace sales channel only)');
  }
  if (template.freeOssUnlicensed !== true) {
    issues.push('freeOssUnlicensed must be true');
  }
  if (template.ownerRepublishRequired !== true) {
    issues.push('ownerRepublishRequired must be true (dashboard republish is the live listing)');
  }
  if (
    template.slug !== 'revealui' ||
    template.templateId !== '5a37bb0e-83bf-4ff7-b327-42c8ae3be350'
  ) {
    issues.push(
      'templateId/slug must match the published listing revealui / 5a37bb0e-83bf-4ff7-b327-42c8ae3be350',
    );
  }

  const apiCac = loadCacFile(repoRoot, API_CAC_REL);
  const adminCac = loadCacFile(repoRoot, ADMIN_CAC_REL);
  if (cacDockerfilePath(apiCac) !== API_DOCKERFILE) {
    issues.push(`${API_CAC_REL} dockerfilePath must be ${API_DOCKERFILE}`);
  }
  if (cacDockerfilePath(adminCac) !== ADMIN_DOCKERFILE) {
    issues.push(`${ADMIN_CAC_REL} dockerfilePath must be ${ADMIN_DOCKERFILE}`);
  }

  for (const issue of findGitServiceWiringIssues(template, {
    api: API_DOCKERFILE,
    admin: ADMIN_DOCKERFILE,
  })) {
    issues.push(`${issue.serviceName}: ${issue.message}`);
  }

  const postgres = template.services.postgres;
  if (!postgres?.source?.image?.startsWith('pgvector/pgvector')) {
    issues.push('postgres source.image must be pgvector/pgvector (not vanilla postgres)');
  }
  const migrate = template.services.migrate;
  if (migrate?.deploy?.restartPolicyType !== 'NEVER') {
    issues.push('migrate deploy.restartPolicyType must be NEVER');
  }

  for (const doc of checkOwnerDocs(repoRoot)) {
    if (doc.missing.length > 0) {
      issues.push(`${doc.relPath} missing phrase(s): ${doc.missing.join(', ')}`);
    }
  }

  return issues;
}

export function main(repoRoot: string = ROOT): number {
  const issues = collectIssues(repoRoot);
  if (issues.length > 0) {
    console.error('✗ Railway marketplace template wiring (GAP-430):');
    for (const issue of issues) {
      console.error(`    ${issue}`);
    }
    console.error('');
    console.error(
      'api + admin must use Dockerfile (or explicit start) so Railpack ' +
        '"No start command detected" cannot happen after owner republish.',
    );
    return 1;
  }

  console.log(
    '✓ Railway marketplace template: api + admin use Dockerfile paths; owner republish docs present',
  );
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
