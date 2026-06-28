/**
 * Storage configuration prompts
 *
 * Cloudflare R2 (S3-compatible) is the canonical (and sole) object-storage
 * backend. The legacy Vercel Blob option was removed in #1644.
 */

import { isCancel, select, text } from '@clack/prompts';
import {
  type CredentialValidation,
  validateR2BucketName,
  validateR2PublicBaseUrl,
} from '../validators/credentials.js';

export interface StorageConfig {
  provider: 'r2' | 'skip';
  // Cloudflare R2 (canonical)
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2Bucket?: string;
  r2PublicBaseUrl?: string;
}

/** Prompt for a required text value, with an optional format validator. */
async function promptRequired(opts: {
  message: string;
  requiredMessage: string;
  validate?: (input: string) => CredentialValidation;
}): Promise<string> {
  const value = await text({
    message: opts.message,
    validate: (input) => {
      if (!input || input.trim() === '') {
        return opts.requiredMessage;
      }
      if (opts.validate) {
        const result = opts.validate(input);
        return result.valid ? undefined : (result.message ?? 'Invalid value');
      }
      return undefined;
    },
  });
  if (isCancel(value)) {
    process.exit(0);
  }
  return value;
}

export async function promptStorageConfig(): Promise<StorageConfig> {
  const provider = await select({
    message: 'Which storage provider would you like to use?',
    options: [
      {
        value: 'r2' as const,
        label: 'Cloudflare R2 - S3-compatible object storage (recommended)',
      },
      { value: 'skip' as const, label: 'Skip - Configure later' },
    ],
    initialValue: 'r2' as const,
  });

  if (isCancel(provider)) {
    process.exit(0);
  }

  if (provider === 'skip') {
    return { provider: 'skip' };
  }

  const r2AccountId = await promptRequired({
    message: 'Enter your Cloudflare account ID:',
    requiredMessage: 'Cloudflare account ID is required',
  });
  const r2AccessKeyId = await promptRequired({
    message: 'Enter your R2 access key ID:',
    requiredMessage: 'R2 access key ID is required',
  });
  const r2SecretAccessKey = await promptRequired({
    message: 'Enter your R2 secret access key:',
    requiredMessage: 'R2 secret access key is required',
  });
  const r2Bucket = await promptRequired({
    message: 'Enter your R2 bucket name:',
    requiredMessage: 'R2 bucket name is required',
    validate: validateR2BucketName,
  });
  const r2PublicBaseUrl = await promptRequired({
    message:
      'Enter your R2 public base URL (custom domain, or https://<account-id>.r2.cloudflarestorage.com/<bucket>):',
    requiredMessage: 'R2 public base URL is required',
    validate: validateR2PublicBaseUrl,
  });

  return {
    provider: 'r2',
    r2AccountId,
    r2AccessKeyId,
    r2SecretAccessKey,
    r2Bucket,
    r2PublicBaseUrl,
  };
}
