import type { Page } from '@revealui/core/types/cms';
import { getCachedGlobal } from '@/lib/utilities/getGlobals';
import { RevealUIHeader } from './RevealUIHeader';

export interface HeaderType {
  id: string;
  navItems?:
    | {
        link: {
          type?: ('reference' | 'custom') | null;
          newTab?: boolean | null;
          reference?: {
            relationTo: 'pages';
            value: string | Page;
          } | null;
          url?: string | null;
          label: string;
        };
        id?: string | null;
      }[]
    | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

export async function Header() {
  const header = (await getCachedGlobal('header', 1)()) as HeaderType | null;

  if (!header) return null;

  // Use RevealUI Header component
  return <RevealUIHeader header={header} />;

  // Uncomment to use the original HeaderClient instead:
  // return <HeaderClient header={header} />;
}
