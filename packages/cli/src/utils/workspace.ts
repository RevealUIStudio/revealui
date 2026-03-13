import fs from 'node:fs';
import path from 'node:path';

export function findWorkspaceRoot(startDir = process.cwd()): string | null {
  let current = path.resolve(startDir);

  while (true) {
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
          name?: string;
          private?: boolean;
        };
        if (pkg.name === 'revealui' && pkg.private === true) {
          return current;
        }
      } catch {
        // Ignore malformed package.json and keep walking upward.
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
