/**
 * Mint handler body validation + generateLicenseKey (unchanged core API).
 */

import { createPrivateKey, createPublicKey, timingSafeEqual } from 'node:crypto';
import { generateLicenseKey } from '@revealui/core/license';
import { z } from 'zod';

export const mintRequestSchema = z.object({
  tier: z.enum(['pro', 'max', 'enterprise']),
  customerId: z.string().min(1),
  domains: z.array(z.string()).optional(),
  maxSites: z.number().int().positive().optional(),
  maxUsers: z.number().int().positive().optional(),
  perpetual: z.boolean().optional(),
  /** When omitted, generateLicenseKey uses the subscription default TTL. */
  expiresInSeconds: z.number().int().positive().nullable().optional(),
  jti: z.string().min(1).optional(),
});

export type MintRequest = z.infer<typeof mintRequestSchema>;

export async function mintLicenseKey(
  req: MintRequest,
  privateKeyPem: string,
  publicKeyPem?: string,
): Promise<string> {
  const expiresIn =
    req.expiresInSeconds === undefined
      ? undefined
      : req.expiresInSeconds === null
        ? null
        : req.expiresInSeconds;

  return generateLicenseKey(
    {
      tier: req.tier,
      customerId: req.customerId,
      domains: req.domains,
      maxSites: req.maxSites,
      maxUsers: req.maxUsers,
      perpetual: req.perpetual,
      jti: req.jti,
    },
    privateKeyPem,
    expiresIn,
    publicKeyPem,
  );
}

export function getSigningPrivateKey(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.REVEALUI_LICENSE_PRIVATE_KEY?.trim() ?? '';
  if (!raw) {
    throw new Error(
      'REVEALUI_LICENSE_PRIVATE_KEY is required in license-signer (PKCS#8 Ed25519 PEM).',
    );
  }
  // Restore PEM newlines when stored as single-line with \n escapes.
  return raw.split('\\n').join('\n');
}

/** Derive the JWT kid source from the actual signer, never an unrelated env hint. */
export function getSigningPublicKey(env: NodeJS.ProcessEnv = process.env): string {
  const privateKey = createPrivateKey(getSigningPrivateKey(env));
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('license-signer private key must be Ed25519');
  }
  const publicKey = createPublicKey(privateKey);
  const derivedDer = publicKey.export({ type: 'spki', format: 'der' });
  const normalizedConfiguredPem = env.REVEALUI_LICENSE_PUBLIC_KEY?.split('\\n').join('\n').trim();
  const configuredPem = normalizedConfiguredPem || undefined;
  if (configuredPem) {
    const configuredKey = createPublicKey(configuredPem);
    if (configuredKey.asymmetricKeyType !== 'ed25519') {
      throw new Error('license-signer configured public key must be Ed25519');
    }
    const configuredDer = configuredKey.export({ type: 'spki', format: 'der' });
    if (configuredDer.length !== derivedDer.length || !timingSafeEqual(configuredDer, derivedDer)) {
      throw new Error('license-signer configured public key does not match its private key');
    }
  }
  return configuredPem ?? publicKey.export({ type: 'spki', format: 'pem' }).toString().trim();
}
