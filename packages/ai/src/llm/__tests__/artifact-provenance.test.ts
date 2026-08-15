import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AceModelArtifactError,
  ArtifactHashMismatchError,
  ArtifactProvenanceError,
  assertArtifactProvenance,
  assertOllamaPullRef,
  assertSafeModelArtifactName,
  assertSnapInstallName,
  fetchProvenancedArtifact,
  isAceDeserializeArtifact,
  isSafeModelArtifactName,
  sha256Hex,
  verifyBytesSha256,
} from '../artifact-provenance.js';

describe('isAceDeserializeArtifact', () => {
  it.each([
    'model.pkl',
    'weights.pickle',
    'clf.joblib',
    'net.pth',
    'net.pt',
    'x.ckpt',
    'pytorch.bin',
  ])('flags %s', (name) => {
    expect(isAceDeserializeArtifact(name)).toBe(true);
  });

  it('does not flag safetensors or gguf', () => {
    expect(isAceDeserializeArtifact('model.safetensors')).toBe(false);
    expect(isAceDeserializeArtifact('gemma3.gguf')).toBe(false);
  });
});

describe('assertSafeModelArtifactName', () => {
  it('allows safetensors, gguf, onnx', () => {
    expect(assertSafeModelArtifactName('weights.safetensors')).toBe('weights.safetensors');
    expect(assertSafeModelArtifactName('/tmp/a.gguf')).toBe('a.gguf');
    expect(assertSafeModelArtifactName('model.ONNX')).toBe('model.ONNX');
  });

  it('refuses pickle-class names', () => {
    expect(() => assertSafeModelArtifactName('evil.pkl')).toThrow(AceModelArtifactError);
    expect(() => assertSafeModelArtifactName('pytorch.bin')).toThrow(AceModelArtifactError);
  });

  it('refuses unknown extensions instead of scanning weights', () => {
    expect(() => assertSafeModelArtifactName('mystery.dat')).toThrow(AceModelArtifactError);
  });
});

describe('assertArtifactProvenance', () => {
  const sha = 'a'.repeat(64);

  it('accepts https + sha256 + safe name', () => {
    const out = assertArtifactProvenance({
      url: 'https://example.com/models/gemma.safetensors',
      sha256: sha,
    });
    expect(out.filename).toBe('gemma.safetensors');
    expect(out.sha256).toBe(sha);
  });

  it('accepts http localhost for operator/dev', () => {
    const out = assertArtifactProvenance({
      url: 'http://127.0.0.1:8080/a.gguf',
      sha256: sha,
    });
    expect(out.filename).toBe('a.gguf');
  });

  it('rejects http remote and missing hash', () => {
    expect(() =>
      assertArtifactProvenance({
        url: 'http://evil.example/a.gguf',
        sha256: sha,
      }),
    ).toThrow(ArtifactProvenanceError);
    expect(() =>
      assertArtifactProvenance({
        url: 'https://example.com/a.gguf',
        sha256: 'not-a-hash',
      }),
    ).toThrow(ArtifactProvenanceError);
  });

  it('rejects pickle URLs even with a hash', () => {
    expect(() =>
      assertArtifactProvenance({
        url: 'https://example.com/model.pkl',
        sha256: sha,
      }),
    ).toThrow(AceModelArtifactError);
  });
});

describe('verifyBytesSha256 / fetchProvenancedArtifact', () => {
  it('verifies matching bytes and rejects a mismatch', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const hex = sha256Hex(bytes);
    verifyBytesSha256(bytes, hex);
    expect(() => verifyBytesSha256(bytes, 'b'.repeat(64))).toThrow(ArtifactHashMismatchError);
  });

  it('fetches only after provenance passes and checks the hash', async () => {
    const payload = new Uint8Array([9, 8, 7]);
    const hex = createHash('sha256').update(payload).digest('hex');
    const fetchFn: typeof fetch = async () =>
      new Response(payload, { status: 200, statusText: 'OK' });
    const got = await fetchProvenancedArtifact(
      { url: 'https://example.com/m.safetensors', sha256: hex },
      { fetch: fetchFn },
    );
    expect(got).toEqual(payload);
  });

  it('does not fetch when the filename is pickle-class', async () => {
    let called = false;
    const fetchFn: typeof fetch = async () => {
      called = true;
      return new Response(new Uint8Array(), { status: 200 });
    };
    await expect(
      fetchProvenancedArtifact(
        { url: 'https://example.com/m.pkl', sha256: 'c'.repeat(64) },
        { fetch: fetchFn },
      ),
    ).rejects.toBeInstanceOf(AceModelArtifactError);
    expect(called).toBe(false);
  });
});

describe('registry names', () => {
  it('allows ollama registry refs and refuses file-like refs', () => {
    expect(assertOllamaPullRef('gemma3:latest')).toBe('gemma3:latest');
    expect(() => assertOllamaPullRef('model.pkl')).toThrow(ArtifactProvenanceError);
    expect(() => assertOllamaPullRef('weights.gguf')).toThrow(ArtifactProvenanceError);
  });

  it('reuses the US-origin snap allowlist', () => {
    expect(assertSnapInstallName('gemma3')).toBe('gemma3');
    expect(() => assertSnapInstallName('deepseek-r1')).toThrow();
  });
});

describe('isSafeModelArtifactName', () => {
  it('is false for empty names', () => {
    expect(isSafeModelArtifactName('')).toBe(false);
    expect(isSafeModelArtifactName('/')).toBe(false);
  });
});
