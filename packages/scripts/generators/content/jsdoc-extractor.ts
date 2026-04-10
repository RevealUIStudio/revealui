/**
 * JSDoc Extractor
 *
 * Extracts JSDoc comments from TypeScript and JavaScript files.
 * Extracted from generate-content.ts for better modularity.
 *
 * @dependencies
 * - node:fs/promises - File system operations (mkdir, writeFile)
 * - node:path - Path utilities (dirname, join, relative)
 * - scripts/lib/index.js - Logger, file utilities, project root
 * - scripts/lib/generators/shared/file-scanner.js - Recursive directory scanning
 * - scripts/lib/generators/shared/pattern-matcher.js - JSDoc pattern matching
 *
 * @example
 * ```typescript
 * import { extractAPIDocs } from './jsdoc-extractor.js'
 *
 * const docs = await extractAPIDocs()
 * ```
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { createLogger, fileExists, getProjectRoot } from '../../index.js';
import { scanDirectoryRecursive } from '../shared/file-scanner.js';
import { matchJSDoc } from '../shared/pattern-matcher.js';

const logger = createLogger({ prefix: 'JSDocs' });

// =============================================================================
// Types
// =============================================================================

export interface ExtractedDoc {
  file: string;
  description: string;
  type: 'jsdoc';
  line?: number;
  tags?: Array<{ name: string; value: string }>;
}

// =============================================================================
// Main Extractor
// =============================================================================

/**
 * Extract API documentation from source files
 *
 * @param options - Extraction options
 * @returns Array of extracted documentation
 *
 * @example
 * ```typescript
 * const docs = await extractAPIDocs()
 * console.log(`Extracted ${docs.length} documentation items`)
 * ```
 */
export async function extractAPIDocs(
  options: { projectRoot?: string; sourceDirs?: string[]; outputPath?: string } = {},
): Promise<ExtractedDoc[]> {
  logger.header('Extracting API Documentation');

  const projectRoot = options.projectRoot || (await getProjectRoot(import.meta.url));
  const sourceDirs = options.sourceDirs || [
    join(projectRoot, 'apps', 'admin', 'src'),
    join(projectRoot, 'packages'),
  ];
  const outputPath = options.outputPath || join(projectRoot, 'docs', 'api', 'extracted-docs.json');

  try {
    const apiDocs: ExtractedDoc[] = [];

    for (const sourceDir of sourceDirs) {
      if (await fileExists(sourceDir)) {
        const docs = await extractFromSource(sourceDir, projectRoot);
        apiDocs.push(...docs);
      }
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(apiDocs, null, 2));

    logger.success(`Extracted documentation for ${apiDocs.length} API items`);
    logger.info(`Output: ${outputPath}`);

    return apiDocs;
  } catch (error) {
    logger.error(`API documentation extraction failed: ${error}`);
    return [];
  }
}

/**
 * Extract documentation from a source directory
 *
 * @param sourceDir - Source directory path
 * @param projectRoot - Project root path
 * @returns Array of extracted documentation
 */
export async function extractFromSource(
  sourceDir: string,
  projectRoot: string,
): Promise<ExtractedDoc[]> {
  const docs: ExtractedDoc[] = [];

  const files = await scanDirectoryRecursive({
    directory: sourceDir,
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules', 'dist', '.next', '.turbo'],
    loadContent: true, // Need content to extract JSDoc
  });

  for (const file of files) {
    if (file.content) {
      const fileDocs = extractFromFile(file.content, relative(projectRoot, file.path));
      docs.push(...fileDocs);
    }
  }

  return docs;
}

/**
 * Extract JSDoc documentation from file content
 *
 * @param content - File content
 * @param relativePath - Relative file path
 * @returns Array of extracted documentation
 */
export function extractFromFile(content: string, relativePath: string): ExtractedDoc[] {
  const docs: ExtractedDoc[] = [];

  const jsdocMatches = matchJSDoc(content);

  for (const match of jsdocMatches) {
    // Only include meaningful descriptions (at least 10 characters)
    if (match.description.trim() && match.description.length > 10) {
      docs.push({
        file: relativePath,
        description: match.description.trim(),
        type: 'jsdoc',
        line: match.line,
        tags: match.tags,
      });
    }
  }

  return docs;
}
