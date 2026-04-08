/**
 * @revealui/ai - Event Storage Implementations
 *
 * Storage backends for persisting agent events.
 */

import type { AnyAgentEvent, EventFilter, EventStorage } from './types.js';

/**
 * In-memory storage (no persistence)
 */
export class MemoryEventStorage implements EventStorage {
  private events: AnyAgentEvent[] = [];

  async save(events: AnyAgentEvent[]): Promise<void> {
    this.events = [...events];
  }

  async load(filter?: EventFilter): Promise<AnyAgentEvent[]> {
    if (!filter) {
      return [...this.events];
    }

    let filtered = [...this.events];

    if (filter.agentId) {
      filtered = filtered.filter((e) => e.agentId === filter.agentId);
    }

    if (filter.sessionId) {
      filtered = filtered.filter((e) => e.sessionId === filter.sessionId);
    }

    if (filter.taskId) {
      filtered = filtered.filter((e) => e.taskId === filter.taskId);
    }

    if (filter.eventType) {
      filtered = filtered.filter((e) => e.eventType === filter.eventType);
    }

    if (filter.startTime) {
      const startTime = filter.startTime;
      filtered = filtered.filter((e) => e.timestamp >= startTime);
    }

    if (filter.endTime) {
      const endTime = filter.endTime;
      filtered = filtered.filter((e) => e.timestamp <= endTime);
    }

    return filtered;
  }

  async clear(): Promise<void> {
    this.events = [];
  }

  async count(filter?: EventFilter): Promise<number> {
    const events = await this.load(filter);
    return events.length;
  }
}

/**
 * Local storage (browser)
 */
export class LocalStorageEventStorage implements EventStorage {
  private key: string;

  constructor(key = 'revealui:agent:events') {
    this.key = key;
  }

  async save(events: AnyAgentEvent[]): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('LocalStorage not available');
    }
    window.localStorage.setItem(this.key, JSON.stringify(events));
  }

  async load(filter?: EventFilter): Promise<AnyAgentEvent[]> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }

    try {
      const data = window.localStorage.getItem(this.key);
      if (!data) {
        return [];
      }

      const events = JSON.parse(data) as AnyAgentEvent[];

      if (!filter) {
        return events;
      }

      let filtered = events;

      if (filter.agentId) {
        filtered = filtered.filter((e) => e.agentId === filter.agentId);
      }

      if (filter.sessionId) {
        filtered = filtered.filter((e) => e.sessionId === filter.sessionId);
      }

      if (filter.taskId) {
        filtered = filtered.filter((e) => e.taskId === filter.taskId);
      }

      if (filter.eventType) {
        filtered = filtered.filter((e) => e.eventType === filter.eventType);
      }

      if (filter.startTime) {
        const startTime = filter.startTime;
        filtered = filtered.filter((e) => e.timestamp >= startTime);
      }

      if (filter.endTime) {
        const endTime = filter.endTime;
        filtered = filtered.filter((e) => e.timestamp <= endTime);
      }

      return filtered;
    } catch (error) {
      // Return empty array on error - graceful degradation
      void (error instanceof Error ? error.message : String(error)); // Query failed — graceful degradation
      return [];
    }
  }

  async clear(): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.removeItem(this.key);
  }

  async count(filter?: EventFilter): Promise<number> {
    const events = await this.load(filter);
    return events.length;
  }
}

/**
 * File system storage (Node.js)
 */
export class FileSystemEventStorage implements EventStorage {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async save(events: AnyAgentEvent[]): Promise<void> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(this.filePath, JSON.stringify(events, null, 2), 'utf-8');
  }

  async load(filter?: EventFilter): Promise<AnyAgentEvent[]> {
    const fs = await import('node:fs/promises');

    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const events = JSON.parse(data) as AnyAgentEvent[];

      if (!filter) {
        return events;
      }

      let filtered = events;

      if (filter.agentId) {
        filtered = filtered.filter((e) => e.agentId === filter.agentId);
      }

      if (filter.sessionId) {
        filtered = filtered.filter((e) => e.sessionId === filter.sessionId);
      }

      if (filter.taskId) {
        filtered = filtered.filter((e) => e.taskId === filter.taskId);
      }

      if (filter.eventType) {
        filtered = filtered.filter((e) => e.eventType === filter.eventType);
      }

      if (filter.startTime) {
        const startTime = filter.startTime;
        filtered = filtered.filter((e) => e.timestamp >= startTime);
      }

      if (filter.endTime) {
        const endTime = filter.endTime;
        filtered = filtered.filter((e) => e.timestamp <= endTime);
      }

      return filtered;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async clear(): Promise<void> {
    const fs = await import('node:fs/promises');

    try {
      await fs.unlink(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async count(filter?: EventFilter): Promise<number> {
    const events = await this.load(filter);
    return events.length;
  }
}
