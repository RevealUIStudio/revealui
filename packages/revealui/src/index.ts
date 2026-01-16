// Main RevealUI exports - re-export core (server) and client functionality

export type {
  FloatingToolbarPluginProps,
  ImageNodeData,
  RichTextEditorProps,
  SerializedImageNode,
  ToolbarPluginProps,
} from './client/index.js'

// Export client (client-side) - but exclude RichTextEditor to avoid conflict with type
// Consumers should import RichTextEditor component from '@revealui/core/richtext-lexical/client' directly
export {
  $createImageNode,
  $isImageNode,
  // Admin
  AdminDashboard,
  APIError,
  APIErrorType,
  // Re-export admin utils
  apiClient,
  CollectionList,
  clearAuthToken,
  DocumentForm,
  FloatingToolbarPlugin,
  fetchBanner,
  fetchCard,
  fetchEvents,
  // HTTP
  fetchFromCMS,
  fetchHero,
  fetchMainInfos,
  fetchVideos,
  generatePageMetadata,
  getAuthHeader,
  getAuthToken,
  ImageNode,
  ImageNodeComponent,
  ImagePlugin,
  ImageUploadButton,
  INSERT_IMAGE_COMMAND,
  NotFoundPage,
  OPEN_IMAGE_UPLOAD_COMMAND,
  RootLayout,
  RootPage,
  // Rich text (exclude RichTextEditor component - use richtext-lexical/client)
  richTextEditorStyles,
  serializeConfig,
  setAuthToken,
  // UI
  ToolbarPlugin,
  // Hooks
  useRevealUI,
  withRevealUIAccess,
} from './client/index.js'
// Export core (server-side) - includes RichTextEditor TYPE
export * from './core/index.js'
