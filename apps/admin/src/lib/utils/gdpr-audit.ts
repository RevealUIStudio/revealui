/**
 * GDPR Audit Trail
 *
 * Appends structured audit entries for GDPR operations (export, delete).
 * Audit records are written to the `gdpr_audit_log` collection when available,
 * falling back to a structured server-side log entry so there is always a
 * durable record of every GDPR action taken.
 */

import type { RevealDataObject, RevealUI } from '@revealui/core';

export interface GDPRAuditEntry {
  action: 'export' | 'delete';
  userId: string;
  requestedBy?: string;
  collections?: string[];
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write a GDPR audit entry.
 *
 * Attempts to persist the entry via the admin `gdpr_audit_log` collection.
 * If the collection is unavailable (e.g. not yet migrated), logs the entry
 * as a structured JSON line so it is captured by the server log aggregator.
 */
export async function writeGDPRAuditEntry(
  revealui: RevealUI,
  entry: GDPRAuditEntry,
): Promise<void> {
  try {
    await revealui.create({
      collection: 'gdpr_audit_log',
      data: entry as unknown as RevealDataObject,
    });
  } catch {
    // Collection may not exist yet  -  fall back to structured log so the audit
    // trail is never silently lost.
    process.stdout.write(
      `${JSON.stringify({ level: 'audit', ...entry, _source: 'gdpr-audit-fallback' })}\n`,
    );
  }
}
