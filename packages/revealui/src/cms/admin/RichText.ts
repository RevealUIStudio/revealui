/**
 * Rich Text Editor Adapter
 * @module @revealui/cms/admin/RichText
 */

export interface RichTextAdapter {
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  features?: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serialize?: (content: any) => string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deserialize?: (content: string) => any
}

export default RichTextAdapter
