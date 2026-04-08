import Link from 'next/link';
import { CMSLink } from '@/lib/components/Link/index';
import { getCachedGlobal } from '@/lib/utilities/getGlobals';

// Define the NavItem type with constrained type property
export interface NavItem {
  link: {
    type?: 'custom' | 'reference' | null; // Constrain type to specific values
    url?: string | null; // Optional URL for custom links
    reference?: {
      relationTo: 'pages' | 'posts'; // Relation type
      value: string | number; // Reference value (ID or slug)
    } | null; // Reference link
  };
}

// Define the FooterType interface
export interface FooterType {
  navItems: NavItem[]; // Array of navigation items
}

// Define the Footer component
export async function Footer() {
  // Ensure "footer" is a valid key in Config["globals"]
  const footer = (await getCachedGlobal('footer')()) as FooterType | null;

  const navItems = footer?.navItems || [];
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-black dark:bg-card text-white">
      <div className="container py-8 gap-8 flex flex-col md:flex-row md:justify-between">
        <Link className="flex items-center" href="/">
          <picture>
            <img alt="RevealUI Logo" className="max-w-24 invert-0" src="/revealui-logo.svg" />
          </picture>
        </Link>

        <nav className="flex flex-col md:flex-row gap-4">
          {navItems.map(({ link }) => {
            const key =
              link.url ??
              (link.reference
                ? `${link.reference.relationTo}:${link.reference.value}`
                : undefined) ??
              'unknown';

            return <CMSLink className="text-white" key={key} {...link} />;
          })}
        </nav>
      </div>
      <div className="container py-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-white/60 text-xs">
        <p>&copy; {currentYear} RevealUI Studio. All rights reserved.</p>
        <div className="flex gap-4">
          <a href="https://revealui.com/privacy" className="hover:text-white/70 transition-colors">
            Privacy Policy
          </a>
          <a href="https://revealui.com/terms" className="hover:text-white/70 transition-colors">
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
}
