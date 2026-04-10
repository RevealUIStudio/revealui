/**
 * API Documentation Generator
 *
 * Generates OpenAPI specifications from route files.
 * Extracted from generate-content.ts for better modularity.
 *
 * @dependencies
 * - node:fs/promises - File system operations (mkdir, readFile, writeFile)
 * - node:path - Path utilities (dirname, join)
 * - scripts/lib/index.js - Logger, file utilities, project root
 * - scripts/lib/generators/shared/file-scanner.js - Recursive directory scanning
 * - scripts/lib/generators/shared/pattern-matcher.js - HTTP method matching
 *
 * @example
 * ```typescript
 * import { generateAPIDocs } from './api-docs.js'
 *
 * await generateAPIDocs()
 * ```
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createLogger, fileExists, getProjectRoot } from '../../index.js';
import { scanDirectoryRecursive } from '../shared/file-scanner.js';
import { matchHTTPMethods } from '../shared/pattern-matcher.js';

const logger = createLogger({ prefix: 'APIDocs' });

// =============================================================================
// Types
// =============================================================================

export interface APIEndpoint {
  path: string;
  method: string;
  description: string;
  parameters?: unknown[];
  responses?: unknown[];
}

interface OpenApiOperation {
  summary: string;
  responses: {
    '200': {
      description: string;
    };
  };
}

type OpenApiPaths = Record<string, Record<string, OpenApiOperation>>;

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  paths: OpenApiPaths;
}

// =============================================================================
// Main Generator
// =============================================================================

/**
 * Generate API documentation from route files
 *
 * @param options - Generation options
 * @returns OpenAPI specification
 *
 * @example
 * ```typescript
 * await generateAPIDocs()
 * ```
 */
export async function generateAPIDocs(
  options: { projectRoot?: string; apiDir?: string; outputPath?: string } = {},
): Promise<OpenApiSpec | null> {
  logger.header('Generating API Documentation');

  const projectRoot = options.projectRoot || (await getProjectRoot(import.meta.url));
  const apiDir = options.apiDir || join(projectRoot, 'apps', 'admin', 'src', 'app', 'api');
  const outputPath =
    options.outputPath || join(projectRoot, 'docs', 'api', 'generated-openapi.json');

  try {
    if (!(await fileExists(apiDir))) {
      logger.warn('API directory not found, skipping API docs generation');
      return null;
    }

    const endpoints = await extractAPIEndpoints(apiDir);
    const openAPISpec = generateOpenAPISpec(endpoints);

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(openAPISpec, null, 2));

    logger.success(`Generated OpenAPI spec with ${endpoints.length} endpoints`);
    logger.info(`Output: ${outputPath}`);

    return openAPISpec;
  } catch (error) {
    logger.error(`API documentation generation failed: ${error}`);
    return null;
  }
}

// =============================================================================
// Endpoint Extraction
// =============================================================================

/**
 * Extract API endpoints from directory
 *
 * @param apiDir - API directory path
 * @returns Array of endpoints
 */
export async function extractAPIEndpoints(apiDir: string): Promise<APIEndpoint[]> {
  const endpoints: APIEndpoint[] = [];

  const files = await scanDirectoryRecursive({
    directory: apiDir,
    extensions: ['.ts', '.js'],
    loadContent: false,
  });

  // Filter for route files only
  const routeFiles = files.filter((f) => f.name === 'route.ts' || f.name === 'route.js');

  for (const routeFile of routeFiles) {
    // Extract endpoint path from directory structure
    const relativePath = routeFile.relativePath
      .replace(/\/route\.(ts|js)$/, '')
      .replace(/\[([^\]]+)\]/g, '{$1}'); // Convert [param] to {param}

    const endpointPath = relativePath ? `/${relativePath}` : '/';

    // Extract HTTP methods from file
    const methods = await extractRouteMethods(routeFile.path);

    for (const method of methods) {
      endpoints.push({
        path: endpointPath,
        method,
        description: `API endpoint: ${method} ${endpointPath}`,
      });
    }
  }

  return endpoints;
}

/**
 * Extract HTTP methods from route file
 *
 * @param routeFile - Path to route file
 * @returns Array of HTTP method names
 */
export async function extractRouteMethods(routeFile: string): Promise<string[]> {
  try {
    const content = await readFile(routeFile, 'utf-8');
    return matchHTTPMethods(content);
  } catch {
    return [];
  }
}

// =============================================================================
// OpenAPI Spec Generation
// =============================================================================

/**
 * Generate OpenAPI specification from endpoints
 *
 * @param endpoints - Array of endpoints
 * @returns OpenAPI specification
 */
export function generateOpenAPISpec(endpoints: APIEndpoint[]): OpenApiSpec {
  const paths: OpenApiPaths = {};

  for (const endpoint of endpoints) {
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {};
    }
    paths[endpoint.path][endpoint.method.toLowerCase()] = {
      summary: endpoint.description,
      responses: {
        '200': {
          description: 'Success',
        },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'RevealUI API',
      version: '1.0.0',
      description: 'Generated API documentation for RevealUI admin',
    },
    paths,
  };
}
