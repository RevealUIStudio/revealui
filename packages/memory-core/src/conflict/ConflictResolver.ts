import type { ConflictResolution } from '../crdt/base/CRDTTypes';

export abstract class ConflictResolver {
  abstract resolve<T>(
    localValue: T, // eslint-disable-line no-unused-vars
    remoteValue: T, // eslint-disable-line no-unused-vars
    localTimestamp: number, // eslint-disable-line no-unused-vars
    remoteTimestamp: number, // eslint-disable-line no-unused-vars
    localNodeId: string, // eslint-disable-line no-unused-vars
    remoteNodeId: string // eslint-disable-line no-unused-vars
  ): ConflictResolution;
}
