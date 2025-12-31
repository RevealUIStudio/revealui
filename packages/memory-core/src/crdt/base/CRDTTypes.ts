export interface CRDTNode {
  id: string;
  timestamp: number;
}

export interface VectorClock {
  entries: Map<string, number>;
}

export interface CRDTOperation {
  type: string;
  nodeId: string;
  timestamp: number;
  data: any;
}

export interface SerializedCRDT {
  type: string;
  nodeId: string;
  data: any;
  vectorClock: Record<string, number>;
}

export interface SerializedLWWRegister<T> extends SerializedCRDT {
  value: T;
  timestamp: number;
}

export interface SerializedORSet extends SerializedCRDT {
  addedElements: Record<string, string[]>;
  removedElements: Record<string, string[]>;
}

export interface SerializedPNCounter extends SerializedCRDT {
  positiveCount: number;
  negativeCount: number;
}

export enum ConflictResolutionStrategy {
  TIMESTAMP = 'timestamp',
  SEMANTIC = 'semantic',
  MANUAL = 'manual',
  PRIORITY = 'priority'
}

export interface ConflictResolution {
  shouldUpdate: boolean;
  value: any;
  timestamp: number;
  reason: string;
}
