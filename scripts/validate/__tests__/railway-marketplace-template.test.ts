/**
 * GAP-430: Railway marketplace Deploy Now must not fall through to Railpack
 * "No start command detected" on api/admin.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_CAC_REL,
  ADMIN_DOCKERFILE,
  API_CAC_REL,
  API_DOCKERFILE,
  cacDockerfilePath,
  findGitServiceWiringIssues,
  findMissingDocPhrases,
  gitServiceAvoidsRailpackNoStart,
  loadCacFile,
  loadMarketplaceTemplate,
  MARKETPLACE_TEMPLATE_REL,
  OWNER_PUBLISH_REL,
  type RailwayMarketplaceService,
  README_REL,
  REQUIRED_DOC_PHRASES,
} from '../railway-marketplace-template.js';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

/** Shape of the 2026-09-15 published listing (https://railway.com/deploy/revealui/manifest.json). */
function publishedRailpackGitService(name: 'api' | 'admin'): RailwayMarketplaceService {
  return {
    name,
    deploy: {
      startCommand: null,
      healthcheckPath: name === 'api' ? '/health' : '/api/health',
    },
    source: {
      repo: 'https://github.com/RevealUIStudio/revealui',
      rootDirectory: null,
    },
    variables: {},
  };
}

describe('gitServiceAvoidsRailpackNoStart', () => {
  it('rejects the 2026-09-15 published api/admin shape (Railpack, empty start)', () => {
    expect(gitServiceAvoidsRailpackNoStart(publishedRailpackGitService('api'))).toBe(false);
    expect(gitServiceAvoidsRailpackNoStart(publishedRailpackGitService('admin'))).toBe(false);
  });

  it('accepts builder DOCKERFILE plus dockerfilePath', () => {
    expect(
      gitServiceAvoidsRailpackNoStart({
        build: { builder: 'DOCKERFILE', dockerfilePath: API_DOCKERFILE },
        deploy: { startCommand: null },
      }),
    ).toBe(true);
  });

  it('accepts RAILWAY_DOCKERFILE_PATH when builder settings are absent', () => {
    expect(
      gitServiceAvoidsRailpackNoStart({
        deploy: { startCommand: null },
        variables: {
          RAILWAY_DOCKERFILE_PATH: { defaultValue: ADMIN_DOCKERFILE },
        },
      }),
    ).toBe(true);
  });

  it('accepts an explicit start command as the Railpack fallback', () => {
    expect(
      gitServiceAvoidsRailpackNoStart({
        deploy: { startCommand: 'node dist/worker.js' },
      }),
    ).toBe(true);
  });
});

describe('findGitServiceWiringIssues', () => {
  it('names both services when the published manifest omits Dockerfile wiring', () => {
    const issues = findGitServiceWiringIssues(
      {
        templateId: '5a37bb0e-83bf-4ff7-b327-42c8ae3be350',
        slug: 'revealui',
        listingUrl: 'https://railway.com/deploy/revealui',
        manifestUrl: 'https://railway.com/deploy/revealui/manifest.json',
        upstreamRepo: 'https://github.com/RevealUIStudio/revealui',
        role: 'customer-marketplace-self-host',
        studioProduction: false,
        freeOssUnlicensed: true,
        ownerRepublishRequired: true,
        services: {
          api: publishedRailpackGitService('api'),
          admin: publishedRailpackGitService('admin'),
        },
      },
      { api: API_DOCKERFILE, admin: ADMIN_DOCKERFILE },
    );
    expect(issues.some((issue) => issue.serviceName === 'api')).toBe(true);
    expect(issues.some((issue) => issue.serviceName === 'admin')).toBe(true);
    expect(issues.some((issue) => issue.message.includes('Railpack-shaped'))).toBe(true);
  });
});

describe('committed marketplace template (Deploy Now SoT)', () => {
  it('ships marketplace-template.json plus the existing CaC files', () => {
    expect(existsSync(join(REPO_ROOT, MARKETPLACE_TEMPLATE_REL))).toBe(true);
    expect(existsSync(join(REPO_ROOT, API_CAC_REL))).toBe(true);
    expect(existsSync(join(REPO_ROOT, ADMIN_CAC_REL))).toBe(true);
  });

  it('wires api and admin to the canonical Dockerfiles (not Railpack)', () => {
    const template = loadMarketplaceTemplate(REPO_ROOT);
    expect(template.studioProduction).toBe(false);
    expect(template.freeOssUnlicensed).toBe(true);
    expect(template.ownerRepublishRequired).toBe(true);
    expect(
      findGitServiceWiringIssues(template, { api: API_DOCKERFILE, admin: ADMIN_DOCKERFILE }),
    ).toEqual([]);

    const apiCac = loadCacFile(REPO_ROOT, API_CAC_REL);
    const adminCac = loadCacFile(REPO_ROOT, ADMIN_CAC_REL);
    expect(cacDockerfilePath(apiCac)).toBe(API_DOCKERFILE);
    expect(cacDockerfilePath(adminCac)).toBe(ADMIN_DOCKERFILE);
    expect(apiCac.build?.builder).toBe('DOCKERFILE');
    expect(adminCac.build?.builder).toBe('DOCKERFILE');
  });

  it('does not invent cash-ladder SKUs or Studio production hosting', () => {
    const listing = readFileSync(join(REPO_ROOT, MARKETPLACE_TEMPLATE_REL), 'utf8');
    expect(listing.includes('$299')).toBe(false);
    expect(listing.toLowerCase().includes('starter kit')).toBe(false);
    const parsed = loadMarketplaceTemplate(REPO_ROOT);
    expect(parsed.role).toBe('customer-marketplace-self-host');
    expect(parsed.studioProduction).toBe(false);
  });
});

describe('owner republish docs', () => {
  it('tells Joshua to republish with RAILWAY_DOCKERFILE_PATH and verify the manifest', () => {
    const readme = readFileSync(join(REPO_ROOT, README_REL), 'utf8');
    const leftover = readFileSync(join(REPO_ROOT, OWNER_PUBLISH_REL), 'utf8');
    expect(findMissingDocPhrases(readme, REQUIRED_DOC_PHRASES)).toEqual([]);
    expect(findMissingDocPhrases(leftover, REQUIRED_DOC_PHRASES)).toEqual([]);
    expect(readme.includes('customer') || leftover.includes('customer')).toBe(true);
    expect(leftover.includes('deployment/railway')).toBe(true);
  });
});
