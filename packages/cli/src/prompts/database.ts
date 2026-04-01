/**
 * Database configuration prompts
 */

import { isCancel, select, text } from '@clack/prompts';
import { validateNeonUrl } from '../validators/credentials.js';

export interface DatabaseConfig {
  provider: 'neon' | 'supabase' | 'local' | 'skip';
  postgresUrl?: string;
}

export async function promptDatabaseConfig(): Promise<DatabaseConfig> {
  const provider = await select({
    message: 'Which database provider would you like to use?',
    options: [
      { value: 'neon' as const, label: 'NeonDB - Serverless PostgreSQL (recommended)' },
      { value: 'supabase' as const, label: 'Supabase - PostgreSQL with built-in features' },
      { value: 'local' as const, label: 'Local PostgreSQL - Use existing local database' },
      { value: 'skip' as const, label: 'Skip - Configure later' },
    ],
    initialValue: 'neon' as const,
  });

  if (isCancel(provider)) {
    process.exit(0);
  }

  if (provider === 'skip') {
    return { provider: 'skip' };
  }

  if (provider === 'local') {
    const postgresUrl = await text({
      message: 'Enter your PostgreSQL connection string:',
      defaultValue: 'postgresql://postgres:postgres@localhost:5432/revealui',
      validate: (input) => {
        if (!input) return undefined;
        const result = validateNeonUrl(input);
        return result.valid ? undefined : result.message || 'Invalid database URL';
      },
    });

    if (isCancel(postgresUrl)) {
      process.exit(0);
    }

    return { provider: 'local', postgresUrl };
  }

  // For Neon or Supabase, get the connection string
  const label = provider === 'neon' ? 'Neon' : 'Supabase';
  const postgresUrl = await text({
    message: `Enter your ${label} database connection string:`,
    validate: (input) => {
      if (!input || input.trim() === '') {
        return 'Database URL is required';
      }
      const result = validateNeonUrl(input);
      return result.valid ? undefined : result.message || 'Invalid database URL';
    },
  });

  if (isCancel(postgresUrl)) {
    process.exit(0);
  }

  return { provider, postgresUrl };
}
