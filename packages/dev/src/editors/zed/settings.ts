import type { ZedSettings } from '../types.js';

export function generateZedSettings(): ZedSettings {
  const biomeFormatter: ZedSettings['formatter'] = {
    external: {
      command: 'biome',
      arguments: ['format', '--write', '{buffer_path}'],
    },
  };

  return {
    formatter: biomeFormatter,
    format_on_save: 'on',
    tab_size: 2,
    hard_tabs: false,
    languages: {
      TypeScript: { tab_size: 2, formatter: biomeFormatter },
      TSX: { tab_size: 2, formatter: biomeFormatter },
      JavaScript: { tab_size: 2 },
      JSON: { tab_size: 2 },
    },
  };
}
