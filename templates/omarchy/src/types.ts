/**
 * Shared Omarchy runtime-template types. Inference is a URL, never Arch snaps.
 */

export const INSTALL_VERBS = [
  'explain_install',
  'point_inference',
  'remind_stream_safe',
  'needs_human',
] as const;

export type InstallVerb = (typeof INSTALL_VERBS)[number];

export const SUPPORTED_HOSTS = ['Omarchy', 'Ubuntu', 'WSL', 'macOS'] as const;

export type SupportedHost = (typeof SUPPORTED_HOSTS)[number];

export const INFERENCE_MODES = ['openai-compatible', 'ollama', 'host-snaps'] as const;

export type InferenceMode = (typeof INFERENCE_MODES)[number];

export interface InferenceEndpoint {
  env: string;
  exampleUrl: string;
  note?: string;
}

export interface OmarchyRuntime {
  version: string;
  sku: null;
  note: string;
  testedOn: 'Omarchy Quattro';
  supportedOn: readonly SupportedHost[];
  inference: {
    preferred: 'openai-compatible' | 'ollama';
    openaiCompatible: InferenceEndpoint;
    ollama: InferenceEndpoint;
    hostSnaps: InferenceEndpoint;
  };
  install: {
    createRevealui: string;
    docker: string;
    cursor: string;
  };
  streamSafe: {
    tip: string;
  };
}
