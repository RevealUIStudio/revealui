import type { HarnessAdapter } from '../types/adapter.js';
import type {
  HarnessCapabilities,
  HarnessCommand,
  HarnessCommandResult,
  HarnessEvent,
  HarnessInfo,
} from '../types/core.js';

/**
 * Stub adapter for GitHub Copilot.
 *
 * Copilot has no standalone CLI — it runs as a VS Code extension.
 * This adapter is a stub for future integration once Copilot exposes
 * a programmatic interface.
 */
export class CopilotAdapter implements HarnessAdapter {
  readonly id = 'copilot';
  readonly name = 'GitHub Copilot';

  private readonly eventHandlers = new Set<(event: HarnessEvent) => void>();

  getCapabilities(): HarnessCapabilities {
    return {
      generateCode: false, // stub — no CLI available
      analyzeCode: false,
      applyEdit: false,
      applyConfig: false,
      readWorkboard: false,
      writeWorkboard: false,
    };
  }

  async getInfo(): Promise<HarnessInfo> {
    return { id: this.id, name: this.name, capabilities: this.getCapabilities() };
  }

  async isAvailable(): Promise<boolean> {
    // Copilot is a VS Code extension — treat it as unavailable for standalone harness use.
    return false;
  }

  notifyRegistered(): void {
    this.emit({ type: 'harness-connected', harnessId: this.id });
  }

  notifyUnregistering(): void {
    this.emit({ type: 'harness-disconnected', harnessId: this.id });
  }

  async execute(command: HarnessCommand): Promise<HarnessCommandResult> {
    return {
      success: false,
      command: command.type,
      message: 'Copilot adapter is a stub — no standalone CLI available',
    };
  }

  onEvent(handler: (event: HarnessEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  async dispose(): Promise<void> {
    this.eventHandlers.clear();
  }

  private emit(event: HarnessEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Swallow subscriber errors
      }
    }
  }
}
