/**
 * CMS Tools Package
 * Complete set of tools for AI-powered CMS management
 */

// Export individual tool definitions (for documentation/reference)
export {
  createDocumentTool,
  deleteDocumentTool,
  findDocumentsTool,
  getDocumentTool,
  listCollectionsTool,
  updateDocumentTool,
} from './collection-tools.js';
export type {
  CMSAPIClient,
  CMSToolsConfig,
  CollectionMetadata,
  GlobalMetadata,
  UserContext,
} from './factory.js';
// Export factory for creating functional tools
export { createCMSTools } from './factory.js';

export { getGlobalTool, listGlobalsTool, updateGlobalTool } from './global-tools.js';

export {
  deleteMediaTool,
  getMediaTool,
  listMediaTool,
  updateMediaTool,
  uploadMediaTool,
} from './media-tools.js';

export {
  createUserTool,
  deleteUserTool,
  getCurrentUserTool,
  listUsersTool,
  updateUserTool,
} from './user-tools.js';
