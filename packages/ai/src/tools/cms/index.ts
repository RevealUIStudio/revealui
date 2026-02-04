/**
 * CMS Tools Package
 * Complete set of tools for AI-powered CMS management
 */

// Export factory for creating functional tools
export { createCMSTools } from './factory.js'
export type { CMSAPIClient, CMSToolsConfig } from './factory.js'

// Export individual tool definitions (for documentation/reference)
export {
  createDocumentTool,
  deleteDocumentTool,
  findDocumentsTool,
  getDocumentTool,
  listCollectionsTool,
  updateDocumentTool,
} from './collection-tools.js'

export { getGlobalTool, listGlobalsTool, updateGlobalTool } from './global-tools.js'

export {
  deleteMediaTool,
  getMediaTool,
  listMediaTool,
  updateMediaTool,
  uploadMediaTool,
} from './media-tools.js'

export {
  createUserTool,
  deleteUserTool,
  getCurrentUserTool,
  listUsersTool,
  updateUserTool,
} from './user-tools.js'
