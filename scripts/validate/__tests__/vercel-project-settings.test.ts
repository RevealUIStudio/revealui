import { describe, expect, it } from 'vitest';
import {
  assertRootVercelJsonGuard,
  diffProjectSettings,
  expectedSettingsForApp,
  liveFromApiBody,
  loadExpectedSettings,
  loadProjectIdMap,
  OFFICIAL_APPS,
  parseAppVercelJson,
  patchBodyFromExpected,
  REPO_ROOT,
} from '../vercel-project-settings';

describe('loadProjectIdMap', () => {
  it('requires prj_ ids for the four official apps', () => {
    const ids = loadProjectIdMap(
      JSON.stringify({
        api: 'prj_api',
        admin: 'prj_admin',
        marketing: 'prj_mkt',
        docs: 'prj_docs',
      }),
    );
    expect(ids.marketing).toBe('prj_mkt');
  });

  it('rejects a missing app', () => {
    let message = '';
    try {
      loadProjectIdMap(JSON.stringify({ api: 'prj_api' }));
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message.includes('.github/vercel-projects.json')).toBe(true);
  });
});

describe('parseAppVercelJson / expectedSettingsForApp', () => {
  it('maps marketing vercel.json to dashboard fields', () => {
    const spec = OFFICIAL_APPS.find((a) => a.app === 'marketing');
    if (!spec) throw new Error('missing marketing spec');
    const expected = expectedSettingsForApp(
      spec,
      {
        api: 'prj_api',
        admin: 'prj_admin',
        marketing: 'prj_mkt',
        docs: 'prj_docs',
      },
      JSON.stringify({
        framework: 'vite',
        buildCommand: 'cd ../.. && pnpm --filter marketing run vercel-build',
        outputDirectory: 'dist',
        installCommand: '',
      }),
    );
    expect(expected.framework).toBe('vite');
    expect(expected.rootDirectory).toBe('apps/marketing');
    expect(expected.outputDirectory).toBe('dist');
    expect(expected.installCommand).toBe('');
    expect(expected.commandForIgnoringBuildStep).toBe('exit 1');
    expect(expected.sourceFilesOutsideRootDirectory).toBe(true);
  });

  it('keeps framework null for Other (api)', () => {
    const parsed = parseAppVercelJson(
      JSON.stringify({
        framework: null,
        buildCommand: 'cd ../.. && pnpm --filter server run vercel-build',
      }),
    );
    expect(parsed.framework).toBeNull();
  });

  it('requires buildCommand', () => {
    const spec = OFFICIAL_APPS[0];
    expect(() =>
      expectedSettingsForApp(
        spec,
        { api: 'prj_a', admin: 'prj_b', marketing: 'prj_c', docs: 'prj_d' },
        JSON.stringify({ framework: 'vite' }),
      ),
    ).toThrow(/buildCommand/);
  });
});

describe('assertRootVercelJsonGuard', () => {
  it('accepts git.deploymentEnabled false only', () => {
    expect(
      assertRootVercelJsonGuard(
        JSON.stringify({
          $schema: 'https://openapi.vercel.sh/vercel.json',
          git: { deploymentEnabled: false },
        }),
      ),
    ).toEqual([]);
  });

  it('rejects a root framework/build that would look like an app', () => {
    const errors = assertRootVercelJsonGuard(
      JSON.stringify({
        git: { deploymentEnabled: false },
        framework: 'vite',
        buildCommand: 'pnpm turbo build --filter=marketing',
        outputDirectory: 'apps/marketing/dist',
      }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('diffProjectSettings', () => {
  const expected = expectedSettingsForApp(
    OFFICIAL_APPS[0],
    { api: 'prj_a', admin: 'prj_b', marketing: 'prj_c', docs: 'prj_d' },
    JSON.stringify({
      framework: 'vite',
      buildCommand: 'cd ../.. && pnpm --filter marketing run vercel-build',
      outputDirectory: 'dist',
      installCommand: '',
    }),
  );

  it('is empty when live matches', () => {
    const live = liveFromApiBody({
      id: 'prj_c',
      name: 'revealui-marketing',
      framework: 'vite',
      rootDirectory: 'apps/marketing',
      buildCommand: 'cd ../.. && pnpm --filter marketing run vercel-build',
      outputDirectory: 'dist',
      installCommand: '',
      commandForIgnoringBuildStep: 'exit 1',
      sourceFilesOutsideRootDirectory: true,
    });
    expect(diffProjectSettings(expected, live)).toEqual([]);
  });

  it('reports the dashboard buildCommand mismatch', () => {
    const live = liveFromApiBody({
      id: 'prj_c',
      name: 'revealui-marketing',
      framework: 'vite',
      rootDirectory: 'apps/marketing',
      buildCommand: 'cd ../.. && pnpm turbo build --filter=marketing',
      outputDirectory: null,
      installCommand: 'cd ../.. && pnpm install --no-frozen-lockfile',
      commandForIgnoringBuildStep: 'exit 1',
      sourceFilesOutsideRootDirectory: true,
    });
    const fields = diffProjectSettings(expected, live).map((d) => d.field);
    expect(fields).toContain('buildCommand');
    expect(fields).toContain('outputDirectory');
    expect(fields).toContain('installCommand');
  });

  it('fails closed when Git is connected', () => {
    const live = liveFromApiBody({
      id: 'prj_c',
      framework: 'vite',
      rootDirectory: 'apps/marketing',
      buildCommand: expected.buildCommand,
      outputDirectory: 'dist',
      installCommand: '',
      commandForIgnoringBuildStep: 'exit 1',
      sourceFilesOutsideRootDirectory: true,
      link: { type: 'github', repo: 'revealui' },
    });
    expect(diffProjectSettings(expected, live).some((d) => d.field === 'git')).toBe(true);
  });
});

describe('loadExpectedSettings (repo files)', () => {
  it('loads all four official apps from the checkout', () => {
    const all = loadExpectedSettings(REPO_ROOT);
    expect(all.map((a) => a.app).sort()).toEqual(['admin', 'api', 'docs', 'marketing']);
    const marketing = all.find((a) => a.app === 'marketing');
    expect(marketing?.framework).toBe('vite');
    expect(marketing?.buildCommand).toContain('pnpm --filter marketing run vercel-build');
    expect(marketing?.outputDirectory).toBe('dist');
    const api = all.find((a) => a.app === 'api');
    expect(api?.framework).toBeNull();
    expect(api?.rootDirectory).toBe('apps/server');
  });
});

describe('patchBodyFromExpected', () => {
  it('sends framework null for Other', () => {
    const api = loadExpectedSettings(REPO_ROOT).find((a) => a.app === 'api');
    if (!api) throw new Error('missing api');
    expect(patchBodyFromExpected(api).framework).toBeNull();
  });
});
