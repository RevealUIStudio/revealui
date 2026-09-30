import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const {
  ACK_LABEL,
  CANONICAL_BACKFLOW_HEAD,
  isBackflowPr,
  isCanonicalAppBackflow,
  parseLabels,
  resolveLabels,
  fetchLiveLabels,
} = require('../backflow-merge-method-guard.cjs');

describe('isBackflowPr', () => {
  it('matches the automated backflow branch onto test', () => {
    expect(
      isBackflowPr(
        'chore(test): backflow main into test (1 commit(s) behind)',
        'chore/backflow-main-into-test',
        'test',
      ),
    ).toBe(true);
  });

  it('does not treat other chore/backflow-* feature branches as backflow', () => {
    expect(
      isBackflowPr(
        'fix(ci): live-fetch backflow labels',
        'chore/backflow-label-live-fetch',
        'test',
      ),
    ).toBe(false);
  });
});

describe('isCanonicalAppBackflow', () => {
  const configuredLogin = 'configured-backflow[bot]';
  const repository = 'RevealUIStudio/revealui';
  const matches = (
    head = CANONICAL_BACKFLOW_HEAD,
    author = configuredLogin,
    expected = configuredLogin,
    source = repository,
    base = repository,
  ) => isCanonicalAppBackflow(head, author, expected, source, base);

  it('accepts the configured App on the canonical branch from this repository', () => {
    expect(matches()).toBe(true);
  });
  it('denies missing or non-bot policy configuration', () => {
    expect(matches(undefined, undefined, '')).toBe(false);
    expect(matches(undefined, undefined, 'human')).toBe(false);
  });
  it('denies a wrong author and a spoofed bot', () => {
    expect(matches(undefined, 'human')).toBe(false);
    expect(matches(undefined, 'spoofed-backflow[bot]')).toBe(false);
  });
  it('denies forks and missing repository provenance', () => {
    expect(matches(undefined, undefined, undefined, 'external/revealui')).toBe(false);
    expect(matches(undefined, undefined, undefined, '')).toBe(false);
    expect(matches(undefined, undefined, undefined, repository, '')).toBe(false);
  });
  it('denies noncanonical branches', () => {
    expect(matches('main')).toBe(false);
    expect(matches('chore/backflow-main-into-test-manual')).toBe(false);
  });
});

describe('parseLabels', () => {
  it('splits the event join list', () => {
    expect(parseLabels('a,backflow:merge-commit,b')).toEqual(['a', ACK_LABEL, 'b']);
  });

  it('treats empty env as no labels', () => {
    expect(parseLabels('')).toEqual([]);
    expect(parseLabels(undefined)).toEqual([]);
  });
});

describe('resolveLabels', () => {
  it('keeps the event list when the ack label is already on the payload', () => {
    expect(resolveLabels([ACK_LABEL], null)).toEqual([ACK_LABEL]);
  });

  it('uses live labels when the event snapshot is empty (open-vs-label race)', () => {
    expect(resolveLabels([], [ACK_LABEL])).toEqual([ACK_LABEL]);
  });

  it('falls back to the event list when live fetch returns null', () => {
    expect(resolveLabels([], null)).toEqual([]);
  });
});

describe('fetchLiveLabels', () => {
  it('returns names when GitHub lists labels', async () => {
    const fetchImpl = async () =>
      ({
        ok: true,
        json: async () => [{ name: ACK_LABEL }, { name: 'other' }],
      }) as Response;
    const names = await fetchLiveLabels({
      repository: 'RevealUIStudio/revealui',
      number: '2750',
      token: 'ghs_test',
      fetchImpl,
    });
    expect(names).toEqual([ACK_LABEL, 'other']);
  });

  it('returns null on 403 so the guard can fall back to the event snapshot', async () => {
    const fetchImpl = async () => ({ ok: false, status: 403 }) as Response;
    const names = await fetchLiveLabels({
      repository: 'RevealUIStudio/revealui',
      number: '2750',
      token: 'ghs_test',
      fetchImpl,
    });
    expect(names).toBeNull();
  });

  it('skips the network when repo, number, or token is missing', async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return { ok: true, json: async () => [] } as Response;
    };
    expect(
      await fetchLiveLabels({
        repository: '',
        number: '2750',
        token: 'ghs_test',
        fetchImpl,
      }),
    ).toBeNull();
    expect(called).toBe(false);
  });
});

describe('repository identity policy enforcement', () => {
  const script = fileURLToPath(new URL('../backflow-merge-method-guard.cjs', import.meta.url));
  const run = (overrides: Record<string, string>) =>
    spawnSync(process.execPath, [script, '--mode=pr'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PR_BASE_REF: 'test',
        PR_HEAD_REF: CANONICAL_BACKFLOW_HEAD,
        PR_AUTHOR_LOGIN: 'configured-backflow[bot]',
        PR_HEAD_REPOSITORY: 'RevealUIStudio/revealui',
        GITHUB_REPOSITORY: 'RevealUIStudio/revealui',
        GITHUB_TOKEN: '',
        PR_LABELS: ACK_LABEL,
        REVEALFLEET_BACKFLOW_APP_LOGIN: 'configured-backflow[bot]',
        ...overrides,
      },
    });
  it('accepts a configured same-repository App', () =>
    expect(run({ PR_LABELS: '' }).status).toBe(0));
  it('denies missing policy even with the acknowledgment label', () =>
    expect(run({ REVEALFLEET_BACKFLOW_APP_LOGIN: '' }).status).toBe(1));
  it('denies wrong canonical-branch author even with the acknowledgment label', () =>
    expect(run({ PR_AUTHOR_LOGIN: 'spoofed[bot]' }).status).toBe(1));
  it('denies fork source even with the acknowledgment label', () =>
    expect(run({ PR_HEAD_REPOSITORY: 'fork/revealui' }).status).toBe(1));
  it('leaves ordinary feature PRs unchanged when policy is absent', () =>
    expect(
      run({ PR_HEAD_REF: 'feat/ordinary', PR_TITLE: 'Feature', REVEALFLEET_BACKFLOW_APP_LOGIN: '' })
        .status,
    ).toBe(0));
});

describe('manual backflow acknowledgment without App policy', () => {
  const script = fileURLToPath(new URL('../backflow-merge-method-guard.cjs', import.meta.url));
  const run = (labels: string) =>
    spawnSync(process.execPath, [script, '--mode=pr'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PR_BASE_REF: 'test',
        PR_HEAD_REF: 'main',
        PR_TITLE: 'Manual backflow main into test',
        PR_AUTHOR_LOGIN: 'human',
        GITHUB_TOKEN: '',
        PR_LABELS: labels,
        REVEALFLEET_BACKFLOW_APP_LOGIN: '',
      },
    });
  it('accepts the existing human acknowledgment', () => expect(run(ACK_LABEL).status).toBe(0));
  it('requires the human acknowledgment', () => expect(run('').status).toBe(1));
});
