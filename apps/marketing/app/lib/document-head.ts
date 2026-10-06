/** Fired after a route writes document.title so analytics can read the new title. */
export const DOCUMENT_HEAD_EVENT = 'revealui:document-head';

export function publishDocumentHead(): void {
  document.dispatchEvent(new CustomEvent(DOCUMENT_HEAD_EVENT));
}
