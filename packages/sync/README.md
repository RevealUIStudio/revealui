# @revealui/sync

ElectricSQL client for real-time sync and local-first storage in RevealUI.

## Overview

This package provides ElectricSQL integration for real-time data synchronization and local-first storage. It uses the official ElectricSQL client for direct database connections and real-time sync capabilities.

## Features

- **Real-time Sync**: Live data synchronization across clients
- **Local-first Storage**: Data available offline
- **Agent Context**: Persistent AI agent state
- **Memory Management**: AI memory storage and retrieval
- **Conversation Sync**: Real-time chat synchronization

## Installation

```bash
pnpm add @revealui/sync
```

## Quick Start

### Provider Setup

```tsx
import { ElectricProvider } from '@revealui/sync'

export default function App() {
  return (
    <ElectricProvider
      serviceUrl="http://localhost:5133"
      debug={process.env.NODE_ENV === 'development'}
    >
      <YourApp />
    </ElectricProvider>
  )
}
```

### Using Agent Context

```tsx
import { useAgentContext } from '@revealui/sync/hooks'

function AgentComponent() {
  const {
    context,
    updateContext,
    saveContext,
    isLoading,
    error
  } = useAgentContext({
    agentId: 'chat-assistant',
    userId: 'user-123',
    autoSave: true,
  })

  const updatePreferences = () => {
    updateContext({
      theme: 'dark',
      language: 'en',
    })
  }

  return (
    <div>
      <button onClick={updatePreferences}>
        Update Preferences
      </button>
    </div>
  )
}
```

### Using Agent Memory

```tsx
import { useAgentMemory } from '@revealui/sync/hooks'

function MemoryComponent() {
  const {
    memories,
    addMemory,
    searchMemories,
    isLoading
  } = useAgentMemory({
    agentId: 'learning-assistant',
    userId: 'user-123',
  })

  const saveInteraction = async () => {
    await addMemory(
      'User prefers dark mode',
      { interaction: 'theme_selection', value: 'dark' },
      0.8 // importance score
    )
  }

  return (
    <div>
      <button onClick={saveInteraction}>
        Save Memory
      </button>
      {memories.map(memory => (
        <div key={memory.id}>{memory.content}</div>
      ))}
    </div>
  )
}
```

### Using Conversations

```tsx
import { useConversations } from '@revealui/sync/hooks'

function ChatComponent() {
  const {
    conversations,
    currentConversation,
    messages,
    createConversation,
    sendMessage,
  } = useConversations({
    userId: 'user-123',
    agentId: 'chat-assistant',
  })

  const startNewChat = async () => {
    await createConversation('New Chat')
  }

  const sendChatMessage = async () => {
    await sendMessage('Hello!', 'user')
  }

  return (
    <div>
      <button onClick={startNewChat}>New Chat</button>
      <button onClick={sendChatMessage}>Send Message</button>
    </div>
  )
}
```

## API Reference

### ElectricProvider

React context provider for ElectricSQL.

**Props:**
- `serviceUrl`: ElectricSQL service URL
- `debug`: Enable debug logging

### useAgentContext

Hook for managing agent context.

**Parameters:**
- `agentId`: Agent identifier
- `userId`: User identifier
- `sessionId?`: Optional session identifier
- `autoSave?`: Auto-save changes (default: true)
- `debounceMs?`: Debounce delay for auto-save (default: 1000)

**Returns:**
- `context`: Current context object
- `updateContext`: Function to update context
- `saveContext`: Function to manually save
- `resetContext`: Function to reset context
- `clearContext`: Function to clear all context

### useAgentMemory

Hook for managing agent memory.

**Parameters:**
- `agentId`: Agent identifier
- `userId`: User identifier
- `limit?`: Maximum memories to load (default: 50)
- `autoSync?`: Enable real-time sync (default: true)

**Returns:**
- `memories`: Array of memory items
- `addMemory`: Function to add new memory
- `updateMemory`: Function to update memory
- `deleteMemory`: Function to delete memory
- `searchMemories`: Function to search memories
- `getMemoryStats`: Function to get memory statistics

### useConversations

Hook for managing conversations.

**Parameters:**
- `userId`: User identifier
- `agentId?`: Optional agent identifier
- `limit?`: Maximum conversations to load (default: 20)
- `autoSync?`: Enable real-time sync (default: true)

**Returns:**
- `conversations`: Array of conversations
- `currentConversation`: Currently selected conversation
- `messages`: Messages in current conversation
- `createConversation`: Function to create new conversation
- `selectConversation`: Function to select conversation
- `sendMessage`: Function to send message
- `deleteConversation`: Function to delete conversation
- `clearConversation`: Function to clear messages

## Configuration

### Environment Variables

```env
# ElectricSQL Service
ELECTRIC_SERVICE_URL=http://localhost:5133
ELECTRIC_DATABASE_URL=postgresql://localhost:5432/postgres
ELECTRIC_TOKEN=your-service-token
ELECTRIC_DEBUG=false
```

### TypeScript Configuration

Update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@revealui/sync": ["../../packages/sync/src"],
      "@revealui/sync/*": ["../../packages/sync/src/*"]
    }
  }
}
```

## Architecture

The sync package is organized as follows:

- **`client/`** - ElectricSQL client and connection management
- **`hooks/`** - React hooks for agent context, memory, and conversations
- **`provider/`** - React context provider for ElectricSQL
- **`shapes.ts`** - Sync shape definitions and creation functions
- **`operations.ts`** - Sync operation utilities
- **`memory/`** - Memory service implementation
- **`collaboration/`** - Collaboration service implementation

## Testing

```bash
# Run tests
pnpm --filter @revealui/sync test

# Run type checking
pnpm --filter @revealui/sync typecheck

# Run build
pnpm --filter @revealui/sync build
```

## Architecture

The sync package implements a hybrid approach:

1. **Mutations**: Handled via RevealUI REST API
2. **Reads**: Served via ElectricSQL for real-time sync
3. **Local Storage**: Data cached locally for offline access
4. **Conflict Resolution**: Automatic conflict resolution for concurrent edits

## Troubleshooting

### Connection Issues

1. Ensure ElectricSQL service is running
2. Check service URL configuration
3. Verify database connectivity
4. Check browser console for connection errors

### Sync Issues

1. Verify table permissions in database
2. Check ElectricSQL shape definitions
3. Ensure proper network connectivity
4. Review sync operation logs

## Contributing

This package is part of the RevealUI framework. See the main repository for contribution guidelines.