export type EditorName = 'vscode' | 'zed' | 'cursor' | 'antigravity';

export interface EditorConfig {
  /** Absolute path to the project root */
  rootDir: string;
  /** Which editors to configure (default: all) */
  editors?: EditorName[];
}

export interface SyncResult {
  written: string[];
  skipped: string[];
  errors: Array<{ path: string; error: string }>;
}

export interface VSCodeSettings {
  'editor.formatOnSave': boolean;
  'editor.defaultFormatter': string;
  '[typescript]': { 'editor.defaultFormatter': string };
  '[typescriptreact]': { 'editor.defaultFormatter': string };
  '[javascript]': { 'editor.defaultFormatter': string };
  '[javascriptreact]': { 'editor.defaultFormatter': string };
  '[json]': { 'editor.defaultFormatter': string };
  '[jsonc]': { 'editor.defaultFormatter': string };
  'typescript.tsdk': string;
  'typescript.enablePromptUseWorkspaceTsdk': boolean;
  'tailwindCSS.experimental.classRegex': string[][];
  'editor.codeActionsOnSave': { 'source.organizeImports': string };
}

export interface ZedSettings {
  formatter: {
    external: {
      command: string;
      arguments: string[];
    };
  };
  format_on_save: 'on' | 'off';
  tab_size: number;
  hard_tabs: boolean;
  languages: {
    TypeScript: { tab_size: number; formatter?: ZedSettings['formatter'] };
    TSX: { tab_size: number; formatter?: ZedSettings['formatter'] };
    JavaScript: { tab_size: number };
    JSON: { tab_size: number };
  };
}
