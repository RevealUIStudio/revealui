/**
 * @revealui/ai - Export Utilities
 *
 * Export agent events to various formats (JSON, CSV, NDJSON).
 */

import type { AgentEventLogger } from './logger.js';
import type { AnyAgentEvent, EventFilter } from './types.js';

/**
 * Export events to JSON format
 */
export function exportToJSON(
  events: AnyAgentEvent[],
  options?: {
    pretty?: boolean;
    metadata?: Record<string, unknown>;
  },
): string {
  const data = options?.metadata
    ? {
        metadata: {
          exportedAt: new Date().toISOString(),
          eventCount: events.length,
          ...options.metadata,
        },
        events,
      }
    : events;

  return options?.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

/**
 * Export events to CSV format
 */
export function exportToCSV(events: AnyAgentEvent[]): string {
  if (events.length === 0) {
    return '';
  }

  // Define common columns
  const columns = [
    'timestamp',
    'eventType',
    'agentId',
    'sessionId',
    'taskId',
    // Decision-specific
    'reasoning',
    'chosenTool',
    'confidence',
    // Tool call-specific
    'toolName',
    'success',
    'durationMs',
    'errorMessage',
    // LLM call-specific
    'provider',
    'model',
    'promptTokens',
    'completionTokens',
    'cost',
    'cacheHit',
    // Error-specific
    'message',
    'recoverable',
    'errorCode',
  ];

  // Create CSV header
  const header = columns.join(',');

  // Create CSV rows
  const rows = events.map((event) => {
    const row: string[] = [];

    for (const column of columns) {
      const value = (event as Record<string, unknown>)[column];
      if (value === undefined || value === null) {
        row.push('');
      } else if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        // Escape strings with commas or quotes
        row.push(`"${value.replace(/"/g, '""')}"`);
      } else {
        row.push(String(value));
      }
    }

    return row.join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Export events to NDJSON format (newline-delimited JSON)
 */
export function exportToNDJSON(events: AnyAgentEvent[]): string {
  return events.map((event) => JSON.stringify(event)).join('\n');
}

/**
 * Export events to a file (Node.js)
 */
export async function exportToFile(
  events: AnyAgentEvent[],
  filePath: string,
  format: 'json' | 'csv' | 'ndjson' = 'json',
): Promise<void> {
  const fs = await import('node:fs/promises');

  let content: string;

  switch (format) {
    case 'json':
      content = exportToJSON(events, { pretty: true });
      break;
    case 'csv':
      content = exportToCSV(events);
      break;
    case 'ndjson':
      content = exportToNDJSON(events);
      break;
  }

  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Create a downloadable file blob (Browser)
 */
export function createDownloadableBlob(
  events: AnyAgentEvent[],
  format: 'json' | 'csv' | 'ndjson' = 'json',
): Blob {
  let content: string;
  let mimeType: string;

  switch (format) {
    case 'json':
      content = exportToJSON(events, { pretty: true });
      mimeType = 'application/json';
      break;
    case 'csv':
      content = exportToCSV(events);
      mimeType = 'text/csv';
      break;
    case 'ndjson':
      content = exportToNDJSON(events);
      mimeType = 'application/x-ndjson';
      break;
  }

  return new Blob([content], { type: mimeType });
}

/**
 * Trigger download in browser
 */
export function downloadEvents(
  events: AnyAgentEvent[],
  filename: string,
  format: 'json' | 'csv' | 'ndjson' = 'json',
): void {
  if (typeof window === 'undefined') {
    throw new Error('downloadEvents can only be used in browser environments');
  }

  const blob = createDownloadableBlob(events, format);
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/**
 * Export helper class with logger integration
 */
export class EventExporter {
  private logger: AgentEventLogger;

  constructor(logger: AgentEventLogger) {
    this.logger = logger;
  }

  /**
   * Export all events
   */
  exportAll(format: 'json' | 'csv' | 'ndjson' = 'json'): string {
    const events = this.logger.getEvents();

    switch (format) {
      case 'json':
        return exportToJSON(events, { pretty: true });
      case 'csv':
        return exportToCSV(events);
      case 'ndjson':
        return exportToNDJSON(events);
    }
  }

  /**
   * Export filtered events
   */
  exportFiltered(filter: EventFilter, format: 'json' | 'csv' | 'ndjson' = 'json'): string {
    const events = this.logger.getEvents(filter);

    switch (format) {
      case 'json':
        return exportToJSON(events, {
          pretty: true,
          metadata: { filter },
        });
      case 'csv':
        return exportToCSV(events);
      case 'ndjson':
        return exportToNDJSON(events);
    }
  }

  /**
   * Export to file (Node.js)
   */
  async exportToFile(
    filePath: string,
    format: 'json' | 'csv' | 'ndjson' = 'json',
    filter?: EventFilter,
  ): Promise<void> {
    const events = filter ? this.logger.getEvents(filter) : this.logger.getEvents();
    await exportToFile(events, filePath, format);
  }

  /**
   * Download in browser
   */
  download(
    filename: string,
    format: 'json' | 'csv' | 'ndjson' = 'json',
    filter?: EventFilter,
  ): void {
    const events = filter ? this.logger.getEvents(filter) : this.logger.getEvents();
    downloadEvents(events, filename, format);
  }

  /**
   * Export by time range
   */
  exportTimeRange(start: Date, end: Date, format: 'json' | 'csv' | 'ndjson' = 'json'): string {
    return this.exportFiltered(
      {
        startTime: start.getTime(),
        endTime: end.getTime(),
      },
      format,
    );
  }

  /**
   * Export by agent
   */
  exportByAgent(agentId: string, format: 'json' | 'csv' | 'ndjson' = 'json'): string {
    return this.exportFiltered({ agentId }, format);
  }

  /**
   * Export by session
   */
  exportBySession(sessionId: string, format: 'json' | 'csv' | 'ndjson' = 'json'): string {
    return this.exportFiltered({ sessionId }, format);
  }

  /**
   * Export errors only
   */
  exportErrors(format: 'json' | 'csv' | 'ndjson' = 'json'): string {
    return this.exportFiltered({ eventType: 'error' }, format);
  }

  /**
   * Export LLM calls only
   */
  exportLLMCalls(format: 'json' | 'csv' | 'ndjson' = 'json'): string {
    return this.exportFiltered({ eventType: 'llm_call' }, format);
  }
}
