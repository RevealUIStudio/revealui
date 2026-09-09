export interface SpeakBackConfig {
  /** localStorage key for the owner toggle (default: revealui.agent.speak-back) */
  preferenceKey: string;
  /** Speak-back starts off unless the owner turns it on */
  defaultEnabled: boolean;
}

const DEFAULT_CONFIG: SpeakBackConfig = {
  preferenceKey: 'revealui.agent.speak-back',
  defaultEnabled: false,
};

let config: SpeakBackConfig = { ...DEFAULT_CONFIG };

export function configureSpeakBack(overrides: Partial<SpeakBackConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides };
}

export function getSpeakBackConfig(): SpeakBackConfig {
  return config;
}

export function resetSpeakBackConfig(): void {
  config = { ...DEFAULT_CONFIG };
}
