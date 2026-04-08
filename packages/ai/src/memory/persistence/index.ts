/**
 * CRDT Persistence Layer
 *
 * Adapters for saving/loading CRDT state to/from database.
 */

export {
  type CRDTOperationPayload,
  type CRDTOperationType,
  CRDTPersistence,
  type CRDTStateData,
  type CRDTType,
} from './crdt-persistence.js';
