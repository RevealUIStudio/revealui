import { RevealUIWordmark } from '@revealui/presentation/server';
import Link from 'next/link';
import { getCachedGlobal } from '@/lib/cms/getGlobals';
import { CMSLink } from '@/lib/components/Link/index';
import { SITE_NAME, SITE_OPERATOR } from '@/lib/utils/siteBranding';

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
        {/*
          This footer is a fixed-dark surface regardless of page theme
          (`bg-black` in light mode, `dark:bg-card` in dark mode - both
          dark). Pin the wordmark's brand-ink and accent tokens to their
          dark-theme values directly, rather than letting them inherit the
          page's ambient [data-theme]: on a light-themed page the inherited
          light-theme ink is a dark navy that reads as invisible against
          this always-black surface.
        */}
        <Link
          className="flex items-center"
          href="/"
          style={
            {
              '--rvui-brand-text': 'oklch(0.78 0.100 240)',
              '--rvui-accent': 'oklch(0.80 0.165 85)',
            } as React.CSSProperties
          }
        >
          <RevealUIWordmark className="text-2xl" />
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
        <p>
          &copy; {currentYear} {SITE_NAME} · Operated by {SITE_OPERATOR}
        </p>
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
