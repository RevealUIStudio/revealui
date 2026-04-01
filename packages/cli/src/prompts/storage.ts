/**
 * Storage configuration prompts
 */

import { isCancel, select, text } from '@clack/prompts';
import { validateSupabaseUrl, validateVercelToken } from '../validators/credentials.js';

export interface StorageConfig {
  provider: 'vercel-blob' | 'supabase' | 'skip';
  blobToken?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
}

export async function promptStorageConfig(): Promise<StorageConfig> {
  const provider = await select({
    message: 'Which storage provider would you like to use?',
    options: [
      { value: 'vercel-blob' as const, label: 'Vercel Blob - Simple object storage (recommended)' },
      { value: 'supabase' as const, label: 'Supabase Storage - Integrated with Supabase' },
      { value: 'skip' as const, label: 'Skip - Configure later' },
    ],
    initialValue: 'vercel-blob' as const,
  });

  if (isCancel(provider)) {
    process.exit(0);
  }

  if (provider === 'skip') {
    return { provider: 'skip' };
  }

  if (provider === 'vercel-blob') {
    const blobToken = await text({
      message: 'Enter your Vercel Blob read/write token:',
      validate: async (input) => {
        if (!input || input.trim() === '') {
          return 'Blob token is required';
        }
        const result = await validateVercelToken(input);
        return result.valid ? undefined : result.message || 'Invalid token';
      },
    });

    if (isCancel(blobToken)) {
      process.exit(0);
    }

    return { provider: 'vercel-blob', blobToken };
  }

  // Supabase storage
  const supabaseUrl = await text({
    message: 'Enter your Supabase project URL:',
    validate: async (input) => {
      if (!input || input.trim() === '') {
        return 'Supabase URL is required';
      }
      const result = await validateSupabaseUrl(input);
      return result.valid ? undefined : result.message || 'Invalid URL';
    },
  });

  if (isCancel(supabaseUrl)) {
    process.exit(0);
  }

  const supabasePublishableKey = await text({
    message: 'Enter your Supabase publishable key (sb_publishable_...):',
    validate: (input) => {
      if (!input || input.trim() === '') {
        return 'Supabase publishable key is required';
      }
      return undefined;
    },
  });

  if (isCancel(supabasePublishableKey)) {
    process.exit(0);
  }

  return {
    provider: 'supabase',
    supabaseUrl,
    supabasePublishableKey,
  };
}
