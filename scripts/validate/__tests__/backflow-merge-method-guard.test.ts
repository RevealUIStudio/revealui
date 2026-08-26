import { describe, expect, it } from 'vitest';

const {
  ACK_LABEL,
  isBackflowPr,
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
