/**
 * Config Contract
 *
 * Unified contract for complete Config (root configuration) that combines:
 * - TypeScript types (compile-time)
 * - Zod schemas (runtime validation)
 * - Validation functions
 * - Type guards
 *
 * This is the single source of truth for Config definitions.
 *
 * @module @revealui/contracts/core/contracts/config-contract
 */

import { z } from 'zod/v4';
import { type Contract, type ContractType, createContract } from '../foundation/contract.js';
import { CollectionStructureSchema, GlobalStructureSchema } from './structure.js';

/**
 * Config structure schema (Zod)
 * Validates the structure of the root Config object
 *
 * Note: This schema validates the STRUCTURE of the config, not function contracts.
 * Functions (access, hooks, onInit, etc.) are validated by TypeScript at compile time.
 */
const ConfigStructureSchema = z
  .object({
    // Required
    secret: z.string().min(1, 'Secret is required'),

    // Collections and globals
    collections: z.array(CollectionStructureSchema).optional(),
    globals: z.array(GlobalStructureSchema).optional(),

    // Server
    serverURL: z.union([z.url(), z.literal('')]).optional(),

    // Admin configuration
    admin: z
      .object({
        user: z.string().optional(),
        meta: z
          .object({
            titleSuffix: z.string().optional(),
            ogImage: z.string().optional(),
            favicon: z.string().optional(),
            icons: z
              .array(
                z.object({
                  url: z.string().optional(),
                  sizes: z.string().optional(),
                  type: z.string().optional(),
                  rel: z.string().optional(),
                  fetchPriority: z.enum(['high', 'low', 'auto']).optional(),
                }),
              )
              .optional(),
          })
          .optional(),
        importMap: z
          .object({
            autoGenerate: z.boolean().optional(),
            baseDir: z.string().optional(),
          })
          .passthrough()
          .optional(),
        css: z.string().optional(),
        scss: z.string().optional(),
        dateFormat: z.string().optional(),
        avatar: z.union([z.literal('default'), z.literal('gravatar'), z.unknown()]).optional(),
        disable: z.boolean().optional(),
        livePreview: z
          .object({
            url: z.union([z.string(), z.unknown()]).optional(), // Function type validated by TypeScript
            collections: z.array(z.string()).optional(),
            globals: z.array(z.string()).optional(),
            breakpoints: z
              .array(
                z.object({
                  label: z.string(),
                  name: z.string(),
                  width: z.number(),
                  height: z.number(),
                }),
              )
              .optional(),
          })
          // Keep passthrough on livePreview for extensibility (documented)
          .passthrough()
          .optional(),
      })
      // No passthrough on admin root - validate strictly
      .optional(),

    // Email configuration
    email: z
      .object({
        fromName: z.string().optional(),
        fromAddress: z.string().email().optional(),
      })
      // No passthrough - validate email config strictly
      .optional(),

    // Localization
    localization: z
      .union([
        z.object({
          locales: z.union([
            z.array(z.string()),
            z.array(
              z.object({
                label: z.string(),
                code: z.string(),
              }),
            ),
          ]),
          defaultLocale: z.string(),
          fallback: z.boolean().optional(),
        }),
        z.literal(false),
      ])
      .optional(),

    // i18n (internationalization)
    i18n: z
      .object({
        locales: z.array(z.string()).optional(),
        defaultLocale: z.string().optional(),
        fallback: z.boolean().optional(),
        supportedLanguages: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),

    // CORS
    cors: z
      .union([
        z.string(),
        z.array(z.string()),
        z.object({
          origins: z.array(z.string()),
          headers: z.array(z.string()).optional(),
        }),
      ])
      .optional(),

    // CSRF
    csrf: z.array(z.string()).optional(),

    // Rate limiting
    rateLimit: z
      .object({
        window: z.number().optional(),
        max: z.number().optional(),
        trustProxy: z.boolean().optional(),
        // skip is a function - not validated here
      })
      // No passthrough - validate rateLimit config strictly
      .optional(),

    // Uploads
    upload: z
      .object({
        limits: z
          .object({
            fileSize: z.number().optional(),
          })
          .optional(),
      })
      .optional(),

    // Debug
    debug: z.boolean().optional(),

    // TypeScript
    typescript: z
      .object({
        outputFile: z.string().optional(),
        declare: z.boolean().optional(),
        autoGenerate: z.boolean().optional(),
      })
      .optional(),

    // Telemetry
    telemetry: z.boolean().optional(),

    // Hooks - functions are not validated here (TypeScript-only)
    hooks: z
      .object({
        // afterError is an array of functions - not validated here
      })
      // No passthrough - validate hooks config strictly
      .optional(),

    // onInit, plugins, editor, sharp, db are functions/any - not validated here
    // These are validated by TypeScript at compile time

    // Custom properties for extensibility (documented extensibility point)
    custom: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) => {
      // At least one collection or global must be present
      return (
        (data.collections && data.collections.length > 0) ||
        (data.globals && data.globals.length > 0)
      );
    },
    {
      message: 'RevealUI config must have at least one collection or global',
      path: ['collections'],
    },
  );
// No passthrough on root - validate structure strictly
// Custom properties should go in the 'custom' field

type ConfigStructure = z.infer<typeof ConfigStructureSchema>;

/**
 * Config Contract
 *
 * This contract validates Config (root configuration) at runtime
 * and provides TypeScript types at compile time.
 *
 * Note: This is a simplified contract. The full Config type includes
 * function contracts (access, hooks) which are validated by TypeScript
 * at compile time, not by Zod at runtime.
 */
export const ConfigContract: Contract<ConfigStructure> = createContract({
  name: 'Config',
  version: '1.0.0',
  schema: ConfigStructureSchema,
  description: 'Root configuration contract',
  docsUrl: 'https://revealui.dev/docs/api-reference/config',
  tags: ['config', 'root', 'admin'],
});

/**
 * Type for Config structure
 * Extracted from the ConfigContract
 */
export type ConfigContractType = ContractType<typeof ConfigContract>;

/**
 * Validate a config structure
 */
export function validateConfigStructure(data: unknown): ReturnType<typeof ConfigContract.validate> {
  return ConfigContract.validate(data);
}

/**
 * Type guard for config structures
 */
export function isConfigStructure(data: unknown): data is ConfigContractType {
  return ConfigContract.isType(data);
}

/**
 * Parse config structure (throws on validation failure)
 */
export function parseConfigStructure(data: unknown): ConfigContractType {
  return ConfigContract.parse(data);
}
