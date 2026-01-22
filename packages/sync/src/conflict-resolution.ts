/**
 * Conflict Resolution System
 *
 * Handles conflicts that arise during multi-device synchronization.
 * Provides strategies for automatic and manual conflict resolution.
 */

import type { ConversationMessage } from '@revealui/contracts/agents'

// =============================================================================
// Types
// =============================================================================

export interface Conflict {
  id: string
  table: string
  recordId: string
  localVersion: any
  remoteVersion: any
  conflictType: 'version' | 'content' | 'deletion'
  timestamp: Date
  resolved?: boolean
  resolution?: ConflictResolution
}

export interface ConflictResolution {
  strategy: 'local' | 'remote' | 'merge' | 'manual'
  resolvedBy: string
  resolvedAt: Date
  mergedData?: any
}

export interface ConflictResolver {
  detectConflicts(localData: any, remoteData: any): Conflict[]
  resolveConflict(conflict: Conflict): Promise<ConflictResolution>
  mergeData(localData: any, remoteData: any): any
}

// =============================================================================
// Conflict Detection
// =============================================================================

export class ConversationConflictDetector {
  detectConflicts(localConv: any, remoteConv: any): Conflict[] {
    const conflicts: Conflict[] = []

    // Version conflict
    if (localConv.version !== remoteConv.version) {
      conflicts.push({
        id: crypto.randomUUID(),
        table: 'conversations',
        recordId: localConv.id,
        localVersion: localConv,
        remoteVersion: remoteConv,
        conflictType: 'version',
        timestamp: new Date(),
      })
    }

    // Content conflict (messages array)
    if (this.hasMessageConflicts(localConv.messages, remoteConv.messages)) {
      conflicts.push({
        id: crypto.randomUUID(),
        table: 'conversations',
        recordId: localConv.id,
        localVersion: localConv,
        remoteVersion: remoteConv,
        conflictType: 'content',
        timestamp: new Date(),
      })
    }

    return conflicts
  }

  private hasMessageConflicts(localMessages: ConversationMessage[], remoteMessages: ConversationMessage[]): boolean {
    if (localMessages.length !== remoteMessages.length) {
      return true
    }

    // Check for message differences
    for (let i = 0; i < localMessages.length; i++) {
      const localMsg = localMessages[i]
      const remoteMsg = remoteMessages[i]

      if (localMsg.id !== remoteMsg.id ||
          localMsg.content !== remoteMsg.content ||
          localMsg.role !== remoteMsg.role) {
        return true
      }
    }

    return false
  }
}

export class MemoryConflictDetector {
  detectConflicts(localMem: any, remoteMem: any): Conflict[] {
    const conflicts: Conflict[] = []

    // Version conflict
    if (localMem.version !== remoteMem.version) {
      conflicts.push({
        id: crypto.randomUUID(),
        table: 'agent_memories',
        recordId: localMem.id,
        localVersion: localMem,
        remoteVersion: remoteMem,
        conflictType: 'version',
        timestamp: new Date(),
      })
    }

    // Content conflict
    if (localMem.content !== remoteMem.content ||
        JSON.stringify(localMem.metadata) !== JSON.stringify(remoteMem.metadata)) {
      conflicts.push({
        id: crypto.randomUUID(),
        table: 'agent_memories',
        recordId: localMem.id,
        localVersion: localMem,
        remoteVersion: remoteMem,
        conflictType: 'content',
        timestamp: new Date(),
      })
    }

    return conflicts
  }
}

// =============================================================================
// Conflict Resolution Strategies
// =============================================================================

export class LastWriteWinsResolver implements ConflictResolver {
  detectConflicts(localData: any, remoteData: any): Conflict[] {
    const conflicts: Conflict[] = []

    // Compare timestamps
    const localTime = new Date(localData.updatedAt || localData.createdAt)
    const remoteTime = new Date(remoteData.updatedAt || remoteData.createdAt)

    if (localTime.getTime() !== remoteTime.getTime()) {
      conflicts.push({
        id: crypto.randomUUID(),
        table: this.getTableName(localData),
        recordId: localData.id,
        localVersion: localData,
        remoteVersion: remoteData,
        conflictType: 'version',
        timestamp: new Date(),
      })
    }

    return conflicts
  }

  async resolveConflict(conflict: Conflict): Promise<ConflictResolution> {
    const localTime = new Date(conflict.localVersion.updatedAt || conflict.localVersion.createdAt)
    const remoteTime = new Date(conflict.remoteVersion.updatedAt || conflict.remoteVersion.createdAt)

    const winner = localTime > remoteTime ? 'local' : 'remote'

    return {
      strategy: winner,
      resolvedBy: 'system',
      resolvedAt: new Date(),
    }
  }

  mergeData(localData: any, remoteData: any): any {
    const localTime = new Date(localData.updatedAt || localData.createdAt)
    const remoteTime = new Date(remoteData.updatedAt || remoteData.createdAt)

    return localTime > remoteTime ? localData : remoteData
  }

  private getTableName(data: any): string {
    if (data.messages) return 'conversations'
    if (data.content && data.type) return 'agent_memories'
    return 'unknown'
  }
}

export class ConversationMergeResolver implements ConflictResolver {
  detectConflicts(localData: any, remoteData: any): Conflict[] {
    const detector = new ConversationConflictDetector()
    return detector.detectConflicts(localData, remoteData)
  }

  async resolveConflict(conflict: Conflict): Promise<ConflictResolution> {
    if (conflict.table !== 'conversations') {
      throw new Error('ConversationMergeResolver only handles conversation conflicts')
    }

    const mergedData = this.mergeConversationData(conflict.localVersion, conflict.remoteVersion)

    return {
      strategy: 'merge',
      resolvedBy: 'system',
      resolvedAt: new Date(),
      mergedData,
    }
  }

  mergeData(localData: any, remoteData: any): any {
    return this.mergeConversationData(localData, remoteData)
  }

  private mergeConversationData(localConv: any, remoteConv: any): any {
    // Merge messages by preserving order and avoiding duplicates
    const allMessages = [...localConv.messages]

    for (const remoteMsg of remoteConv.messages) {
      const exists = allMessages.some((msg: ConversationMessage) => msg.id === remoteMsg.id)
      if (!exists) {
        allMessages.push(remoteMsg)
      }
    }

    // Sort by timestamp
    allMessages.sort((a: ConversationMessage, b: ConversationMessage) => {
      const aTime = new Date(a.timestamp || 0).getTime()
      const bTime = new Date(b.timestamp || 0).getTime()
      return aTime - bTime
    })

    return {
      ...localConv,
      messages: allMessages,
      updatedAt: new Date(),
      version: Math.max(localConv.version || 1, remoteConv.version || 1) + 1,
    }
  }
}

export class ManualConflictResolver implements ConflictResolver {
  detectConflicts(localData: any, remoteData: any): Conflict[] {
    // Manual resolver doesn't auto-detect conflicts
    // Conflicts are flagged by other detectors for manual resolution
    return []
  }

  async resolveConflict(conflict: Conflict): Promise<ConflictResolution> {
    // This would typically open a UI for manual resolution
    // For now, default to local version
    return {
      strategy: 'manual',
      resolvedBy: 'user',
      resolvedAt: new Date(),
      mergedData: conflict.localVersion, // Default to local
    }
  }

  mergeData(localData: any, remoteData: any): any {
    // Manual merge - return local data as default
    return localData
  }
}

// =============================================================================
// Conflict Resolution Manager
// =============================================================================

export class ConflictResolutionManager {
  private resolvers: Map<string, ConflictResolver> = new Map()

  constructor() {
    // Register default resolvers
    this.registerResolver('conversations', new ConversationMergeResolver())
    this.registerResolver('agent_memories', new LastWriteWinsResolver())
    this.registerResolver('default', new LastWriteWinsResolver())
  }

  registerResolver(tableName: string, resolver: ConflictResolver): void {
    this.resolvers.set(tableName, resolver)
  }

  async resolveConflicts(conflicts: Conflict[]): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = []

    for (const conflict of conflicts) {
      const resolver = this.resolvers.get(conflict.table) || this.resolvers.get('default')!
      const resolution = await resolver.resolveConflict(conflict)
      resolutions.push(resolution)
    }

    return resolutions
  }

  detectConflicts(tableName: string, localData: any, remoteData: any): Conflict[] {
    const resolver = this.resolvers.get(tableName) || this.resolvers.get('default')!
    return resolver.detectConflicts(localData, remoteData)
  }

  mergeData(tableName: string, localData: any, remoteData: any): any {
    const resolver = this.resolvers.get(tableName) || this.resolvers.get('default')!
    return resolver.mergeData(localData, remoteData)
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

export function createConflictResolutionManager(): ConflictResolutionManager {
  return new ConflictResolutionManager()
}

export function detectAllConflicts(localData: any[], remoteData: any[], tableName: string): Conflict[] {
  const manager = createConflictResolutionManager()
  const conflicts: Conflict[] = []

  // Create lookup maps
  const localMap = new Map(localData.map(item => [item.id, item]))
  const remoteMap = new Map(remoteData.map(item => [item.id, item]))

  // Find conflicts
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

  for (const id of allIds) {
    const localItem = localMap.get(id)
    const remoteItem = remoteMap.get(id)

    if (localItem && remoteItem) {
      // Both exist - check for conflicts
      const itemConflicts = manager.detectConflicts(tableName, localItem, remoteItem)
      conflicts.push(...itemConflicts)
    }
  }

  return conflicts
}