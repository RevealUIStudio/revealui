/**
 * Field Validation Executor Tests
 *
 * Covers runFieldValidators directly and its wiring into create()/update():
 * a field's `validate` predicate now runs on ingress and rejects the write when
 * it returns an error message.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DatabaseResult,
  RevealCollectionConfig,
  RevealCreateOptions,
  RevealUpdateOptions,
} from '../../../types/index.js';
import { create } from '../create.js';
import { runFieldValidators, ValidationError } from '../fieldValidation.js';
import { findByID } from '../findById.js';
import { update } from '../update.js';

vi.mock('../findById', () => ({
  findByID: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn() },
}));

/** A field's `validate` predicate, typed loosely to match the contracts signature. */
type Validate = (value: unknown, args: unknown) => string | true | Promise<string | true>;

const configWith = (validate: Validate): RevealCollectionConfig => ({
  slug: 'test',
  fields: [{ name: 'url', type: 'text', validate } as never],
});

describe('runFieldValidators', () => {
  it('resolves when the predicate returns true', async () => {
    await expect(
      runFieldValidators(
        configWith(() => true),
        { url: 'https://ok.example' },
        'create',
      ),
    ).resolves.toBeUndefined();
  });

  it('throws ValidationError with the predicate message on a string return', async () => {
    const config = configWith((v) =>
      typeof v === 'string' && v.startsWith('javascript:') ? 'Unsafe URL scheme' : true,
    );
    const err = await runFieldValidators(config, { url: 'javascript:alert(1)' }, 'create').catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toBe('Unsafe URL scheme');
    expect((err as ValidationError).status).toBe(400);
    expect((err as ValidationError).statusCode).toBe(400);
    expect((err as ValidationError).field).toBe('url');
  });

  it('skips fields not present in the payload (partial update)', async () => {
    const validate = vi.fn<Validate>(() => 'should not run');
    await expect(
      runFieldValidators(configWith(validate), { other: 'x' }, 'update'),
    ).resolves.toBeUndefined();
    expect(validate).not.toHaveBeenCalled();
  });

  it('passes value, data, siblingData, operation and req to the predicate', async () => {
    const validate = vi.fn<Validate>(() => true);
    const req = { user: { id: 'u1' } } as never;
    await runFieldValidators(configWith(validate), { url: 'https://x' }, 'update', req);
    expect(validate).toHaveBeenCalledWith('https://x', {
      value: 'https://x',
      data: { url: 'https://x' },
      siblingData: { url: 'https://x' },
      operation: 'update',
      req,
    });
  });

  it('awaits async predicates', async () => {
    const config = configWith((v) =>
      v === 'bad' ? Promise.resolve('nope') : Promise.resolve(true),
    );
    await expect(runFieldValidators(config, { url: 'bad' }, 'create')).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('runs validators on fields nested inside row/tabs containers', async () => {
    const validate = vi.fn<Validate>(() => 'row field rejected');
    const config: RevealCollectionConfig = {
      slug: 'test',
      fields: [
        {
          type: 'row',
          fields: [{ name: 'nested', type: 'text', validate }],
        } as never,
      ],
    };
    await expect(runFieldValidators(config, { nested: 'v' }, 'create')).rejects.toThrow(
      'row field rejected',
    );
    expect(validate).toHaveBeenCalledOnce();
  });
});

describe('create()/update() wiring', () => {
  const mockDb = { query: vi.fn() };

  const config = configWith((v) =>
    typeof v === 'string' && v.startsWith('javascript:') ? 'Unsafe URL scheme' : true,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    // Row present so update()'s existence check passes; create() ignores rows
    // (it reads the created doc via the mocked findByID).
    mockDb.query.mockResolvedValue({ rows: [{ id: 'id1' }] } as DatabaseResult);
    vi.mocked(findByID).mockResolvedValue({ id: 'id1', url: 'https://ok' } as never);
  });

  it('create() rejects a document whose field validate fails', async () => {
    const options: RevealCreateOptions = { data: { url: 'javascript:alert(1)' } };
    await expect(create(config, mockDb as never, options)).rejects.toThrow('Unsafe URL scheme');
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('create() proceeds when field validate passes', async () => {
    const options: RevealCreateOptions = { data: { url: 'https://ok.example' } };
    await expect(create(config, mockDb as never, options)).resolves.toBeTruthy();
    expect(mockDb.query).toHaveBeenCalled();
  });

  it('update() rejects a patch whose field validate fails', async () => {
    const options: RevealUpdateOptions = { id: 'id1', data: { url: 'javascript:alert(1)' } };
    await expect(update(config, mockDb as never, options)).rejects.toThrow('Unsafe URL scheme');
  });

  it('update() proceeds when field validate passes', async () => {
    const options: RevealUpdateOptions = { id: 'id1', data: { url: 'https://ok.example' } };
    await expect(update(config, mockDb as never, options)).resolves.toBeTruthy();
  });
});
