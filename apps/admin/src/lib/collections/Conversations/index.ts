import type { RevealCollectionConfig } from '@revealui/core/types';
import { CONVERSATION_STATUSES } from '@revealui/db/schema/agents';
import { z } from 'zod';
import { isAdmin } from '@/lib/access';

const conversationOwnerSchema = z.object({ id: z.string().min(1) });

function conversationOwnerWhere(req: { user?: unknown } | undefined) {
  // Auth adapters provide this value at runtime; parse it before using an ID
  // in an access predicate.
  const owner = conversationOwnerSchema.safeParse(req?.user);
  return owner.success ? { userId: { equals: owner.data.id } } : false;
}

/**
 * Conversations Collection
 *
 * Stores conversations between users and agents.
 * Auto-generates REST API endpoints:
 * - GET    /api/conversations
 * - GET    /api/conversations/:id
 * - POST   /api/conversations
 * - PATCH  /api/conversations/:id
 * - DELETE /api/conversations/:id
 */
export const Conversations: RevealCollectionConfig = {
  slug: 'conversations',
  access: {
    create: ({ req, data }) => {
      const owner = conversationOwnerSchema.safeParse(req.user);
      if (!owner.success) return false;
      if (isAdmin({ req })) return true;
      return data?.userId === owner.data.id;
    },
    read: ({ req }) => {
      const ownerWhere = conversationOwnerWhere(req);
      if (ownerWhere === false) return false;
      if (isAdmin({ req })) return true;
      return ownerWhere;
    },
    update: ({ req }) => {
      const ownerWhere = conversationOwnerWhere(req);
      if (ownerWhere === false) return false;
      if (isAdmin({ req })) return true;
      return ownerWhere;
    },
    delete: ({ req }) => {
      const ownerWhere = conversationOwnerWhere(req);
      if (ownerWhere === false) return false;
      if (isAdmin({ req })) return true;
      return ownerWhere;
    },
  },
  admin: {
    defaultColumns: ['id', 'userId', 'agentId', 'status', 'createdAt', 'updatedAt'],
    useAsTitle: 'id',
  },
  fields: [
    {
      name: 'id',
      type: 'text',
      unique: true,
      admin: {
        description: 'Unique conversation identifier',
      },
    },
    {
      name: 'version',
      type: 'number',
      defaultValue: 1,
      admin: {
        description: 'Schema version for migration handling',
      },
    },
    {
      name: 'userId',
      type: 'text',
      required: true,
      admin: {
        description: 'User involved in this conversation',
      },
    },
    {
      name: 'agentId',
      type: 'text',
      required: true,
      admin: {
        description: 'Agent involved in this conversation',
      },
    },
    {
      name: 'title',
      type: 'text',
      admin: {
        description: 'Conversation title or summary',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: CONVERSATION_STATUSES.map((value) => ({
        label: value.charAt(0).toUpperCase() + value.slice(1),
        value,
      })),
      defaultValue: 'active',
      admin: {
        description: 'Current status of the conversation',
      },
    },
    {
      name: 'deviceId',
      type: 'text',
    },
    {
      name: 'lastSyncedAt',
      type: 'date',
    },
    {
      name: 'createdAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'When this conversation was created',
      },
    },
    {
      name: 'updatedAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'When this conversation was last updated',
      },
    },
  ],
};
