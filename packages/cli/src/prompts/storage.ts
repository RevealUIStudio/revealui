/**
 * Storage configuration prompts
 */

import inquirer from 'inquirer'
import { validateSupabaseUrl, validateVercelToken } from '../validators/credentials.js'

export interface StorageConfig {
  provider: 'vercel-blob' | 'supabase' | 'skip'
  blobToken?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
}

export async function promptStorageConfig(): Promise<StorageConfig> {
  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Which storage provider would you like to use?',
      choices: [
        {
          name: 'Vercel Blob - Simple object storage (recommended)',
          value: 'vercel-blob',
        },
        {
          name: 'Supabase Storage - Integrated with Supabase',
          value: 'supabase',
        },
        {
          name: 'Skip - Configure later',
          value: 'skip',
        },
      ],
      default: 'vercel-blob',
    },
  ])

  if (provider === 'skip') {
    return { provider: 'skip' }
  }

  if (provider === 'vercel-blob') {
    const { blobToken } = await inquirer.prompt([
      {
        type: 'input',
        name: 'blobToken',
        message: 'Enter your Vercel Blob read/write token:',
        validate: async (input: string) => {
          if (!input || input.trim() === '') {
            return 'Blob token is required'
          }
          const result = await validateVercelToken(input)
          return result.valid ? true : result.message || 'Invalid token'
        },
      },
    ])
    return { provider: 'vercel-blob', blobToken }
  }

  // Supabase storage
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'supabaseUrl',
      message: 'Enter your Supabase project URL:',
      validate: async (input: string) => {
        if (!input || input.trim() === '') {
          return 'Supabase URL is required'
        }
        const result = await validateSupabaseUrl(input)
        return result.valid ? true : result.message || 'Invalid URL'
      },
    },
    {
      type: 'input',
      name: 'supabaseAnonKey',
      message: 'Enter your Supabase anonymous key:',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'Supabase anonymous key is required'
        }
        return true
      },
    },
  ])

  return {
    provider: 'supabase',
    supabaseUrl: answers.supabaseUrl,
    supabaseAnonKey: answers.supabaseAnonKey,
  }
}
