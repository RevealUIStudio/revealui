import type { CollectionConfig } from '@revealui/core';
import { authenticated, isAdmin } from '@/lib/access';

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
export const Conversations: CollectionConfig = {
  slug: 'conversations',
  access: {
    create: authenticated,
    read: ({ req }) => {
      const user = req?.user as { id?: string } | null;
      if (!user?.id) return false;
      if (isAdmin({ req })) return true;
      return { user_id: { equals: user.id } };
    },
    update: ({ req }) => {
      const user = req?.user as { id?: string } | null;
      if (!user?.id) return false;
      if (isAdmin({ req })) return true;
      return { user_id: { equals: user.id } };
    },
    delete: ({ req }) => {
      const user = req?.user as { id?: string } | null;
      if (!user?.id) return false;
      if (isAdmin({ req })) return true;
      return { user_id: { equals: user.id } };
    },
  },
  admin: {
    defaultColumns: ['id', 'session_id', 'user_id', 'agent_id', 'created_at', 'updated_at'],
    useAsTitle: 'id',
  },
  fields: [
    {
      name: 'id',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Unique conversation identifier',
      },
    },
    {
      name: 'version',
      type: 'number',
      required: true,
      defaultValue: 1,
      admin: {
        description: 'Schema version for migration handling',
      },
    },
    {
      name: 'session_id',
      type: 'text',
      required: true,
      admin: {
        description: 'Session this conversation belongs to',
      },
    },
    {
      name: 'user_id',
      type: 'text',
      required: true,
      admin: {
        description: 'User involved in this conversation',
      },
    },
    {
      name: 'agent_id',
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
      name: 'messages',
      type: 'array',
      fields: [
        {
          name: 'role',
          type: 'text',
          required: true,
        },
        {
          name: 'content',
          type: 'textarea',
          required: true,
        },
        {
          name: 'timestamp',
          type: 'date',
        },
      ],
      admin: {
        description: 'Messages in this conversation',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Completed', value: 'completed' },
        { label: 'Abandoned', value: 'abandoned' },
      ],
      defaultValue: 'active',
      admin: {
        description: 'Current status of the conversation',
      },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional conversation metadata (title, tags, summary, etc.)',
      },
    },
    {
      name: 'created_at',
      type: 'date',
      required: true,
      admin: {
        description: 'When this conversation was created',
      },
    },
    {
      name: 'updated_at',
      type: 'date',
      required: true,
      admin: {
        description: 'When this conversation was last updated',
      },
    },
  ],
};
