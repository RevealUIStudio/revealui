import { CookieSettingsButton, GitHubIcon } from '@revealui/presentation';
import {
  FOOTER_LEGAL,
  FOOTER_LEGAL_LINKS,
  FOOTER_TAGLINE,
  PRODUCT_FOOTER_LINKS,
} from '../content/nav';
import { SITE } from '../content/site';

export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-muted py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="max-w-sm text-sm leading-6 text-body">{FOOTER_TAGLINE}</p>
            <a
              href={SITE.urls.repo}
              className="inline-flex text-muted-foreground transition-colors hover:text-foreground"
              aria-label="GitHub"
            >
              <GitHubIcon className="size-5" />
            </a>
          </div>

          <ul className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
            {PRODUCT_FOOTER_LINKS.map(({ label, href, external }) => (
              <li key={label}>
                <a
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="transition-colors hover:text-foreground"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-border pt-8 text-sm text-muted-foreground">
          <p>
            &copy; {currentYear}{' '}
            <a
              href={FOOTER_LEGAL.operatorHref}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {FOOTER_LEGAL.operator}
            </a>{' '}
            ({FOOTER_LEGAL.jurisdiction}).
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {FOOTER_LEGAL_LINKS.map(({ label, href }) => (
              <a key={label} href={href} className="transition-colors hover:text-foreground">
                {label}
              </a>
            ))}
            <CookieSettingsButton className="transition-colors hover:text-foreground" />
          </p>
        </div>
      </div>
    </footer>
  );
}
