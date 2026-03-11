/**
 * Database configuration prompts
 */

import inquirer from 'inquirer';
import { validateNeonUrl } from '../validators/credentials.js';

export interface DatabaseConfig {
  provider: 'neon' | 'supabase' | 'local' | 'skip';
  postgresUrl?: string;
}

export async function promptDatabaseConfig(): Promise<DatabaseConfig> {
  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Which database provider would you like to use?',
      choices: [
        {
          name: 'NeonDB - Serverless PostgreSQL (recommended)',
          value: 'neon',
        },
        {
          name: 'Supabase - PostgreSQL with built-in features',
          value: 'supabase',
        },
        {
          name: 'Local PostgreSQL - Use existing local database',
          value: 'local',
        },
        {
          name: 'Skip - Configure later',
          value: 'skip',
        },
      ],
      default: 'neon',
    },
  ]);

  if (provider === 'skip') {
    return { provider: 'skip' };
  }

  if (provider === 'local') {
    const { postgresUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'postgresUrl',
        message: 'Enter your PostgreSQL connection string:',
        default: 'postgresql://postgres:postgres@localhost:5432/revealui',
        validate: async (input: string) => {
          const result = await validateNeonUrl(input);
          return result.valid ? true : result.message || 'Invalid database URL';
        },
      },
    ]);
    return { provider: 'local', postgresUrl };
  }

  // For Neon or Supabase, get the connection string
  const { postgresUrl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'postgresUrl',
      message: `Enter your ${provider === 'neon' ? 'Neon' : 'Supabase'} database connection string:`,
      validate: async (input: string) => {
        if (!input || input.trim() === '') {
          return 'Database URL is required';
        }
        const result = await validateNeonUrl(input);
        return result.valid ? true : result.message || 'Invalid database URL';
      },
    },
  ]);

  return { provider, postgresUrl };
}
