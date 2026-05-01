/**
 * File discovery utilities for auto-generating documentation indexes
 */

/**
 * Discovered file information
 */
export interface DiscoveredFile {
  /**
   * Relative path from section root (e.g., "getting-started.md")
   */
  path: string;
  /**
   * Display name (derived from filename)
   */
  name: string;
  /**
   * Whether this is a directory/package
   */
  isDirectory?: boolean;
}

/**
 * Discover available markdown files in a section
 * Note: This is a client-side implementation that relies on a manifest
 * or attempts to discover files by trying common paths
 */
export async function discoverFiles(
  section: 'guides' | 'api' | 'reference',
): Promise<DiscoveredFile[]> {
  // Try to load a manifest file first (if it exists)
  const manifestPath = `/${section}/.manifest.json`;

  try {
    const response = await fetch(manifestPath);
    if (response.ok) {
      const manifest = (await response.json()) as { files?: DiscoveredFile[] };
      return manifest.files ?? [];
    }
  } catch {
    // Manifest not found, continue with fallback discovery
  }

  // Fallback: Try to discover common files
  const commonFiles: DiscoveredFile[] = [];

  // Common guide files
  if (section === 'guides') {
    const guideFiles = ['getting-started', 'installation', 'configuration', 'deployment', 'usage'];

    for (const file of guideFiles) {
      try {
        const response = await fetch(`/${section}/${file}.md`, {
          method: 'HEAD',
        });
        if (response.ok) {
          commonFiles.push({
            path: `${file}.md`,
            name: formatDisplayName(file),
          });
        }
      } catch {
        // File doesn't exist, skip
      }
    }
  }

  // Common API files
  if (section === 'api') {
    const apiPackages = ['revealui-core', 'revealui-schema', 'revealui-db'];

    for (const pkg of apiPackages) {
      try {
        const response = await fetch(`/${section}/${pkg}/README.md`, {
          method: 'HEAD',
        });
        if (response.ok) {
          commonFiles.push({
            path: `${pkg}/README.md`,
            name: formatDisplayName(pkg),
            isDirectory: true,
          });
        }
      } catch {
        // Package doesn't exist, skip
      }
    }
  }

  return commonFiles;
}

/**
 * Format a filename into a display name
 */
function formatDisplayName(filename: string): string {
  // Remove extension
  const withoutExt = filename.replace(/\.(md|mdx)$/, '');

  // Convert kebab-case to Title Case
  return withoutExt
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate an index page markdown from discovered files
 */
export function generateIndexMarkdown(
  section: 'guides' | 'api' | 'reference',
  files: DiscoveredFile[],
): string {
  const sectionTitle = section.charAt(0).toUpperCase() + section.slice(1);

  let markdown = `# ${sectionTitle}\n\n`;

  if (files.length === 0) {
    markdown += `No ${section} found. Check back soon!\n`;
    return markdown;
  }

  markdown += `## Available ${sectionTitle}\n\n`;

  for (const file of files) {
    const displayPath = file.isDirectory
      ? `${file.path.replace('/README.md', '')}`
      : file.path.replace('.md', '');

    markdown += `- [${file.name}](./${displayPath})\n`;
  }

  markdown += `\n---\n\n`;
  markdown += `*This index is auto-generated. Files are discovered automatically.*\n`;

  return markdown;
}
