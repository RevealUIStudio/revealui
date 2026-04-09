import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { generateAntigravityRules } from './antigravity/index.js';
import type { EditorConfig, EditorName, SyncResult } from './types.js';
import { generateVSCodeExtensions, generateVSCodeSettings } from './vscode/index.js';
import { generateZedSettings } from './zed/index.js';

const ALL_EDITORS: EditorName[] = ['vscode', 'zed', 'antigravity'];

async function writeIfChanged(
  filePath: string,
  content: string,
  result: SyncResult,
): Promise<void> {
  try {
    const existing = await readFile(filePath, 'utf8').catch(() => null);
    if (existing === content) {
      result.skipped.push(filePath);
      return;
    }
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf8');
    result.written.push(filePath);
  } catch (err) {
    result.errors.push({ path: filePath, error: err instanceof Error ? err.message : String(err) });
  }
}

async function writeVSCodeConfigs(rootDir: string, result: SyncResult): Promise<void> {
  const vsDir = join(rootDir, '.vscode');
  await writeIfChanged(
    join(vsDir, 'settings.json'),
    `${JSON.stringify(generateVSCodeSettings(), null, 2)}\n`,
    result,
  );
  await writeIfChanged(
    join(vsDir, 'extensions.json'),
    `${JSON.stringify(generateVSCodeExtensions(), null, 2)}\n`,
    result,
  );
}

export async function syncEditorConfigs(config: EditorConfig): Promise<SyncResult> {
  const { rootDir } = config;
  const editors = config.editors ?? ALL_EDITORS;
  const result: SyncResult = { written: [], skipped: [], errors: [] };

  // Deduplicate: VS Code configs are shared by vscode and antigravity.
  // Write them once if either editor is requested.
  const needsVSCode = editors.some((e) => e === 'vscode' || e === 'antigravity');
  if (needsVSCode) {
    await writeVSCodeConfigs(rootDir, result);
  }

  for (const editor of editors) {
    switch (editor) {
      case 'vscode':
        // Already written above
        break;

      case 'antigravity':
        await writeIfChanged(
          join(rootDir, '.agents', 'rules', 'revealui.md'),
          `${generateAntigravityRules()}\n`,
          result,
        );
        break;

      case 'zed':
        await writeIfChanged(
          join(rootDir, '.zed', 'settings.json'),
          `${JSON.stringify(generateZedSettings(), null, 2)}\n`,
          result,
        );
        break;
    }
  }

  return result;
}
