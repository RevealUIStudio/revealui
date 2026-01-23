/**
 * Conflict Resolution System
 *
 * Handles conflicts that arise during multi-device synchronization.
 * Integrates with ElectricSQL for real conflict detection and resolution.
 */

import type { ConversationMessage } from '@revealui/contracts/agents'

// =============================================================================
// Types
// =============================================================================

export interface Conflict {
  id: string
  table: string
  recordId: string
  localVersion: Record<string, unknown>
  remoteVersion: Record<string, unknown>
  conflictType: 'version' | 'content' | 'deletion'
  timestamp: Date
  resolved?: boolean
  resolution?: ConflictResolution
}

export interface ConflictResolution {
  strategy: 'local' | 'remote' | 'merge' | 'manual'
  resolvedBy: string
  resolvedAt: Date
  mergedData?: Record<string, unknown>
}

export interface ConflictResolver {
  detectConflicts(localData: Record<string, unknown>, remoteData: Record<string, unknown>): Conflict[]
  resolveConflict(conflict: Conflict): Promise<ConflictResolution>
  mergeData(localData: Record<string, unknown>, remoteData: Record<string, unknown>): Record<string, unknown>
}

// =============================================================================
// ElectricSQL-Aware Conflict Detection
// =============================================================================

export class ElectricConversationConflictDetector {
  detectConflicts(localConv: Record<string, unknown>, remoteConv: Record<string, unknown>): Conflict[] {
    const conflicts: Conflict[] = []

    // Version conflict - ElectricSQL handles this
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

    // Message content conflict
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

export class ElectricMemoryConflictDetector {
  detectConflicts(localMem: Record<string, unknown>, remoteMem: Record<string, unknown>): Conflict[] {
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
// ElectricSQL Conflict Resolution Strategies
// =============================================================================

export class ElectricLastWriteWinsResolver implements ConflictResolver {
  detectConflicts(localData: Record<string, unknown>, remoteData: Record<string, unknown>): Conflict[] {
    const conflicts: Conflict[] = []

    // Compare timestamps (ElectricSQL provides this)
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
      resolvedBy: 'electric-system',
      resolvedAt: new Date(),
    }
  }

  mergeData(localData: Record<string, unknown>, remoteData: Record<string, unknown>): Record<string, unknown> {
    const localTime = new Date(localData.updatedAt || localData.createdAt)
    const remoteTime = new Date(remoteData.updatedAt || remoteData.createdAt)

    return localTime > remoteTime ? localData : remoteData
  }

  private getTableName(data: Record<string, unknown>): string {
    if (data.messages) return 'conversations'
    if (data.content && data.type) return 'agent_memories'
    return 'unknown'
  }
}

export class ElectricConversationMergeResolver implements ConflictResolver {
  detectConflicts(localData: Record<string, unknown>, remoteData: Record<string, unknown>): Conflict[] {
    const detector = new ElectricConversationConflictDetector()
    return detector.detectConflicts(localData, remoteData)
  }

  async resolveConflict(conflict: Conflict): Promise<ConflictResolution> {
    if (conflict.table !== 'conversations') {
      throw new Error('ElectricConversationMergeResolver only handles conversation conflicts')
    }

    const mergedData = this.mergeConversationData(conflict.localVersion, conflict.remoteVersion)

    return {
      strategy: 'merge',
      resolvedBy: 'electric-system',
      resolvedAt: new Date(),
      mergedData,
    }
  }

  mergeData(localData: Record<string, unknown>, remoteData: Record<string, unknown>): Record<string, unknown> {
    return this.mergeConversationData(localData, remoteData)
  }

  private mergeConversationData(localConv: Record<string, unknown>, remoteConv: Record<string, unknown>): Record<string, unknown> {
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

// =============================================================================
// ElectricSQL Conflict Resolution Manager
// =============================================================================

export class ElectricConflictResolutionManager {
  private resolvers: Map<string, ConflictResolver> = new Map()

  constructor() {
    // Register ElectricSQL-aware resolvers
    this.registerResolver('conversations', new ElectricConversationMergeResolver())
    this.registerResolver('agent_memories', new ElectricLastWriteWinsResolver())
    this.registerResolver('default', new ElectricLastWriteWinsResolver())
  }

  registerResolver(tableName: string, resolver: ConflictResolver): void {
    this.resolvers.set(tableName, resolver)
  }

  async resolveConflicts(conflicts: Conflict[]): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = []

    for (const conflict of conflicts) {
      const resolver = this.resolvers.get(conflict.table) || this.resolvers.get('default')
      if (!resolver) {
        throw new Error(`No resolver found for table: ${conflict.table}`)
      }
      const resolution = await resolver.resolveConflict(conflict)
      resolutions.push(resolution)
    }

    return resolutions
  }

  detectConflicts(tableName: string, localData: Record<string, unknown>, remoteData: Record<string, unknown>): Conflict[] {
    const resolver = this.resolvers.get(tableName) || this.resolvers.get('default')
    if (!resolver) {
      throw new Error(`No resolver found for table: ${tableName}`)
    }
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

export function createConflictResolutionManager(): ElectricConflictResolutionManager {
  return new ElectricConflictResolutionManager()
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