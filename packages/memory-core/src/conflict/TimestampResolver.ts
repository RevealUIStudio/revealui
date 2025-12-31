import type { ConflictResolution } from '../crdt/base/CRDTTypes';

import { ConflictResolver } from './ConflictResolver';

export class TimestampResolver extends ConflictResolver {
  resolve<T>(
    localValue: T,
    remoteValue: T,
    localTimestamp: number,
    remoteTimestamp: number,
    localNodeId: string,
    remoteNodeId: string
  ): ConflictResolution {
    if (remoteTimestamp > localTimestamp) {
      return {
        shouldUpdate: true,
        value: remoteValue,
        timestamp: remoteTimestamp,
        reason: 'Remote timestamp is newer'
      };
    } else if (localTimestamp > remoteTimestamp) {
      return {
        shouldUpdate: false,
        value: localValue,
        timestamp: localTimestamp,
        reason: 'Local timestamp is newer'
      };
    } else {
      // Same timestamp - use node ID for deterministic resolution
      const shouldUpdate = remoteNodeId > localNodeId;
      return {
        shouldUpdate,
        value: shouldUpdate ? remoteValue : localValue,
        timestamp: localTimestamp,
        reason: `Same timestamp, resolved by node ID (${shouldUpdate ? 'remote' : 'local'} wins)`
      };
    }
  }
}
