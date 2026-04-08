/**
 * Ticket label database queries
 */

import { and, eq } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { ticketLabelAssignments, ticketLabels } from '../schema/tickets.js';

export async function getLabelById(db: Database, id: string) {
  const result = await db.select().from(ticketLabels).where(eq(ticketLabels.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getAllLabels(db: Database, tenantId?: string) {
  if (tenantId) {
    return db
      .select()
      .from(ticketLabels)
      .where(eq(ticketLabels.tenantId, tenantId))
      .orderBy(ticketLabels.name);
  }
  return db.select().from(ticketLabels).orderBy(ticketLabels.name);
}

export async function createLabel(
  db: Database,
  data: {
    id: string;
    name: string;
    slug: string;
    color?: string;
    description?: string;
    tenantId?: string;
  },
) {
  const result = await db.insert(ticketLabels).values(data).returning();
  return result[0];
}

export async function updateLabel(
  db: Database,
  id: string,
  data: Partial<{ name: string; slug: string; color: string; description: string }>,
) {
  const result = await db
    .update(ticketLabels)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(ticketLabels.id, id))
    .returning();

  return result[0] ?? null;
}

export async function deleteLabel(db: Database, id: string) {
  await db.delete(ticketLabels).where(eq(ticketLabels.id, id));
}

export async function assignLabel(
  db: Database,
  data: { id: string; ticketId: string; labelId: string },
) {
  const result = await db.insert(ticketLabelAssignments).values(data).returning();
  return result[0];
}

export async function removeLabel(db: Database, ticketId: string, labelId: string) {
  await db
    .delete(ticketLabelAssignments)
    .where(
      and(
        eq(ticketLabelAssignments.ticketId, ticketId),
        eq(ticketLabelAssignments.labelId, labelId),
      ),
    );
}

export async function getLabelsForTicket(db: Database, ticketId: string) {
  const assignments = await db
    .select({
      label: ticketLabels,
    })
    .from(ticketLabelAssignments)
    .innerJoin(ticketLabels, eq(ticketLabelAssignments.labelId, ticketLabels.id))
    .where(eq(ticketLabelAssignments.ticketId, ticketId))
    .orderBy(ticketLabels.name);

  return assignments.map((a) => a.label);
}
