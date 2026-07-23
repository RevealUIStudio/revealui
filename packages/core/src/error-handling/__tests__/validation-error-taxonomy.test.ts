/**
 * P2-A fleet-redundancy: ValidationError taxonomy.
 * Domain vs client classes must not share instanceof identity or name-guard paths.
 */
import { describe, expect, it } from 'vitest';
import { ValidationError as FieldIngressValidationError } from '../../collections/operations/fieldValidation.js';
import { ValidationError as DomainValidationError } from '../../utils/errors.js';
import {
  ValidationError as BoundaryValidationAlias,
  ClientValidationError,
  isClientValidationError,
  isValidationError,
} from '../error-boundary.js';

describe('ValidationError taxonomy (P2-A)', () => {
  it('domain and client classes are distinct constructors', () => {
    const domain = new DomainValidationError('bad', 'email', 'x');
    const client = new ClientValidationError('bad', { email: 'required' });

    expect(domain).toBeInstanceOf(DomainValidationError);
    expect(client).toBeInstanceOf(ClientValidationError);
    expect(domain).not.toBeInstanceOf(ClientValidationError);
    expect(client).not.toBeInstanceOf(DomainValidationError);
    expect(domain.name).toBe('ValidationError');
    expect(client.name).toBe('ClientValidationError');
  });

  it('field-ingress re-exports the domain class', () => {
    const err = new FieldIngressValidationError('Unsafe URL scheme', 'url');
    expect(err).toBeInstanceOf(DomainValidationError);
    expect(err.status).toBe(400);
    expect(err.statusCode).toBe(400);
  });

  it('isClientValidationError is instanceof-only (no name spoof)', () => {
    const spoof = new Error('spoof');
    spoof.name = 'ValidationError';
    const spoofClient = new Error('spoof');
    spoofClient.name = 'ClientValidationError';

    expect(isClientValidationError(spoof)).toBe(false);
    expect(isClientValidationError(spoofClient)).toBe(false);
    expect(isValidationError(spoof)).toBe(false);
    expect(isClientValidationError(new ClientValidationError('ok'))).toBe(true);
    expect(isValidationError(new BoundaryValidationAlias('ok'))).toBe(true);
  });

  it('domain ValidationError is not a client validation error', () => {
    const domain = new DomainValidationError('bad', 'f', 1);
    expect(isClientValidationError(domain)).toBe(false);
    expect(isValidationError(domain)).toBe(false);
  });
});
