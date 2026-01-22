# @revealui/sync

Database-powered sync client with foundation for real-time capabilities in RevealUI.

## Overview

This package provides database-powered synchronization for agent memory, context, and conversations. It uses the existing database infrastructure with a foundation that can be extended with ElectricSQL for real-time sync when available.

## Features

- **Agent Context**: Persistent AI agent state management
- **Memory Management**: AI memory storage and retrieval with search
- **Conversation Sync**: Chat conversation management
- **Database Integration**: Works with existing RevealUI database
- **Future-Ready**: Architecture designed for ElectricSQL integration
- **Type Safety**: Full TypeScript support with proper contracts

## Installation

```bash
pnpm add @revealui/sync
```

## Quick Start

### Provider Setup

```tsx
import { SyncProvider } from '@revealui/sync'

export default function App() {
  return (
    <SyncProvider
      databaseType="rest"
      debug={process.env.NODE_ENV === 'development'}
    >
      <YourApp />
    </SyncProvider>
  )
}
```

### Using Agent Memory

```tsx
import { useAgentMemory } from '@revealui/sync/hooks'

function MemoryManager() {
  const { memories, addMemory, searchMemories, isLoading } = useAgentMemory({
    agentId: 'learning-agent',
    userId: currentUser.id,
    limit: 50
  })

  const saveMemory = async () => {
    await addMemory(
      'User prefers dark mode',
      { theme: 'dark' },
      0.8,
      'preference'
    )
  }

  return (
    <div>
      <button onClick={saveMemory}>Save Memory</button>
      {memories.map(memory => (
        <div key={memory.id}>{memory.content}</div>
      ))}
    </div>
  )
}
```

### Using Agent Context

```tsx
import { useAgentContext } from '@revealui/sync/hooks'

function AgentSettings() {
  const { context, updateContext, saveContext, hasUnsavedChanges } = useAgentContext({
    agentId: 'settings-agent',
    userId: currentUser.id,
    autoSave: true
  })

  const updateTheme = () => {
    updateContext({ theme: 'dark', language: 'en' })
  }

  return (
    <div>
      <button onClick={updateTheme}>Update Theme</button>
      {hasUnsavedChanges && <span>Unsaved changes</span>}
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
    sendMessage
  } = useConversations({
    userId: currentUser.id,
    agentId: 'chat-assistant',
    limit: 20
  })

  const startChat = async () => {
    await createConversation('New Chat')
  }

  const sendChatMessage = async () => {
    await sendMessage('Hello!', 'user')
  }

  return (
    <div>
      <button onClick={startChat}>New Chat</button>
      <button onClick={sendChatMessage}>Send Message</button>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
    </div>
  )
}
```

## API Reference

### SyncProvider

React context provider for database sync.

**Props:**
- `databaseType?`: Database type ('rest' | 'vector')
- `debug?`: Enable debug logging
- `autoConnect?`: Auto-connect on mount (default: true)

### useAgentMemory

Hook for agent memory management.

**Parameters:**
- `agentId`: Agent identifier
- `userId`: User identifier
- `limit?`: Maximum memories to load
- `minImportance?`: Minimum importance filter
- `type?`: Memory type filter

**Returns:**
- `memories`: Array of memory items
- `addMemory`: Function to add new memory
- `updateMemory`: Function to update memory
- `deleteMemory`: Function to delete memory
- `searchMemories`: Function to search memories
- `getMemoryStats`: Function to get memory statistics
- `clearMemories`: Function to clear all memories
- `refresh`: Function to refresh memories

### useAgentContext

Hook for agent context management.

**Parameters:**
- `agentId`: Agent identifier
- `userId`: User identifier
- `sessionId?`: Optional session identifier
- `autoSave?`: Auto-save changes
- `debounceMs?`: Debounce delay for auto-save

**Returns:**
- `context`: Current context object
- `updateContext`: Function to update context
- `saveContext`: Function to manually save
- `resetContext`: Function to reset context
- `clearContext`: Function to clear context
- `hasUnsavedChanges`: Whether there are unsaved changes

### useConversations

Hook for conversation management.

**Parameters:**
- `userId`: User identifier
- `agentId?`: Optional agent identifier
- `limit?`: Maximum conversations to load

**Returns:**
- `conversations`: Array of conversations
- `currentConversation`: Currently selected conversation
- `messages`: Messages in current conversation
- `createConversation`: Function to create new conversation
- `selectConversation`: Function to select conversation
- `sendMessage`: Function to send message
- `deleteConversation`: Function to delete conversation
- `clearConversation`: Function to clear messages

## Architecture

The sync package is organized as follows:

- **`client/`** - Sync client and database connection management
- **`hooks/`** - React hooks for agent context, memory, and conversations
- **`provider/`** - React context provider for sync services
- **`shapes.ts`** - Shape definitions for future ElectricSQL integration
- **`operations.ts`** - Sync operation utilities
- **`memory/`** - Memory service implementation
- **`collaboration/`** - Collaboration service implementation

## Current Implementation

The current implementation uses:
- **In-memory storage** for development and testing
- **Database client integration** ready for production
- **Type-safe interfaces** compatible with RevealUI contracts
- **Extensible architecture** for ElectricSQL integration

## Future: ElectricSQL Integration

## Future Enhancements

- Real-time synchronization protocols
- Conflict resolution strategies
- Multi-device sync optimization
- Performance monitoring and metrics

## Testing

```bash
# Run tests
pnpm --filter @revealui/sync test

# Run type checking
pnpm --filter @revealui/sync typecheck

# Run build
pnpm --filter @revealui/sync build
```

## Contributing

This package is part of the RevealUI framework. See the main repository for contribution guidelines.