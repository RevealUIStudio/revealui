import type { VSCodeSettings } from '../types.js';

export function generateVSCodeSettings(): VSCodeSettings {
  return {
    'editor.formatOnSave': true,
    'editor.defaultFormatter': 'biomejs.biome',
    '[typescript]': { 'editor.defaultFormatter': 'biomejs.biome' },
    '[typescriptreact]': { 'editor.defaultFormatter': 'biomejs.biome' },
    '[javascript]': { 'editor.defaultFormatter': 'biomejs.biome' },
    '[javascriptreact]': { 'editor.defaultFormatter': 'biomejs.biome' },
    '[json]': { 'editor.defaultFormatter': 'biomejs.biome' },
    '[jsonc]': { 'editor.defaultFormatter': 'biomejs.biome' },
    'typescript.tsdk': 'node_modules/typescript/lib',
    'typescript.enablePromptUseWorkspaceTsdk': true,
    'tailwindCSS.experimental.classRegex': [
      ['cva\\(([^)]*)\\)', '["\'`]([^"\'`]*).*?["\'`]'],
      ['cx\\(([^)]*)\\)', '["\'`]([^"\'`]*).*?["\'`]'],
    ],
    'editor.codeActionsOnSave': {
      'source.organizeImports': 'explicit',
    },
  };
}
