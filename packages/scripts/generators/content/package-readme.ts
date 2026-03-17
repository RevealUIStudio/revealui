/**
 * Package README Generator
 *
 * Generates README.md files for packages based on package.json.
 * Extracted from generate-content.ts for better modularity.
 *
 * @dependencies
 * - node:fs/promises - File system operations (readFile, readdir, writeFile)
 * - node:path - Path utilities (join)
 * - scripts/lib/index.js - Logger, project root utilities
 *
 * @example
 * ```typescript
 * import { generatePackageReadmes } from './package-readme.js'
 *
 * await generatePackageReadmes()
 * ```
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger, getProjectRoot } from '../../index.js';

const logger = createLogger({ prefix: 'README' });

// =============================================================================
// Types
// =============================================================================

export interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  exports?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  author?: string;
  license?: string;
}

export interface ReadmeGenerationResult {
  packageName: string;
  success: boolean;
  error?: string;
}

// =============================================================================
// Main Generator
// =============================================================================

/**
 * Generate README files for all packages
 *
 * @param options - Generation options
 * @returns Array of generation results
 *
 * @example
 * ```typescript
 * const results = await generatePackageReadmes()
 * console.log(`Generated ${results.filter(r => r.success).length} READMEs`)
 * ```
 */
export async function generatePackageReadmes(
  options: { projectRoot?: string; packagesDir?: string } = {},
): Promise<ReadmeGenerationResult[]> {
  logger.header('Generating Package READMEs');

  const projectRoot = options.projectRoot || (await getProjectRoot(import.meta.url));
  const packagesDir = options.packagesDir || join(projectRoot, 'packages');

  const results: ReadmeGenerationResult[] = [];

  try {
    const entries = await readdir(packagesDir, { withFileTypes: true });
    const packages = entries.filter((entry) => entry.isDirectory());

    for (const pkg of packages) {
      const result = await generatePackageReadme(packagesDir, pkg.name);
      results.push(result);

      if (result.success) {
        logger.success(`Generated README for ${result.packageName}`);
      } else {
        logger.warn(`Failed to generate README for ${pkg.name}: ${result.error}`);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    logger.success(`Generated READMEs for ${successCount}/${packages.length} packages`);
  } catch (error) {
    logger.error(`Package README generation failed: ${error}`);
  }

  return results;
}

/**
 * Generate README for a single package
 *
 * @param packagesDir - Packages directory path
 * @param packageName - Package directory name
 * @returns Generation result
 */
export async function generatePackageReadme(
  packagesDir: string,
  packageName: string,
): Promise<ReadmeGenerationResult> {
  const packagePath = join(packagesDir, packageName);
  const packageJsonPath = join(packagePath, 'package.json');

  try {
    const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
    const packageJson: PackageJson = JSON.parse(packageJsonContent);
    const readmeContent = generateReadmeContent(packageJson);

    const readmePath = join(packagePath, 'README.md');
    await writeFile(readmePath, readmeContent);

    return {
      packageName: packageJson.name || packageName,
      success: true,
    };
  } catch (error) {
    return {
      packageName,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// Content Generation
// =============================================================================

/**
 * Generate README content from package.json
 *
 * @param packageJson - Package.json data
 * @returns README markdown content
 *
 * @example
 * ```typescript
 * const content = generateReadmeContent(packageJson)
 * ```
 */
export function generateReadmeContent(packageJson: PackageJson): string {
  const name = packageJson.name || 'Unknown Package';
  const description = packageJson.description || 'No description available';
  const version = packageJson.version || '0.0.0';

  let content = `# ${name}

${description}

## Version
${version}

## Installation
\`\`\`bash
pnpm add ${name}
\`\`\`
`;

  // Add exports section if available
  if (packageJson.exports && Object.keys(packageJson.exports).length > 0) {
    content += '\n## Exports\n\n';
    for (const [key, value] of Object.entries(packageJson.exports)) {
      content += `- \`${key}\`: ${value}\n`;
    }
  }

  // Add dependencies section if available
  if (packageJson.dependencies) {
    const deps = Object.keys(packageJson.dependencies);
    if (deps.length > 0) {
      content += '\n## Dependencies\n\n';
      for (const dep of deps) {
        content += `- ${dep}\n`;
      }
    }
  }

  // Add scripts section if available
  if (packageJson.scripts && Object.keys(packageJson.scripts).length > 0) {
    content += '\n## Scripts\n\n';
    const scriptEntries = Object.entries(packageJson.scripts);
    for (const [scriptName, scriptCmd] of scriptEntries) {
      content += `- \`${scriptName}\`: \`${scriptCmd}\`\n`;
    }
  }

  // Add author and license if available
  if (packageJson.author || packageJson.license) {
    content += '\n## Metadata\n\n';
    if (packageJson.author) {
      content += `- **Author**: ${packageJson.author}\n`;
    }
    if (packageJson.license) {
      content += `- **License**: ${packageJson.license}\n`;
    }
  }

  return content;
}
