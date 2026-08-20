import type { ReactElement } from 'react';
import { isEditModeActive } from '../lib/edit-mode';

/**
 * In-iframe chrome for a live edit session. Hidden for ordinary visitors
 * (no `rvui-edit` token). Tells the operator what is clickable on this page.
 */
export function EditModeBanner(): ReactElement | null {
  if (typeof window === 'undefined' || !isEditModeActive()) return null;
  return (
    <div
      role="status"
      className="border-b border-primary/30 bg-primary/10 px-4 py-2 text-center text-sm text-foreground"
    >
      Edit mode — click outlined copy to change it. Home hero, proof, and pricing stay on the
      claim-covered modules.
    </div>
  );
}
