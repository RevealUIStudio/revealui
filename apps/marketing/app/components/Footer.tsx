import {
  BuiltWithRevealUI,
  CookieSettingsButton,
  GitHubIcon,
  LinkedInIcon,
} from '@revealui/presentation';
import {
  FOOTER_CLAIMS_LEDGER_NOTE,
  FOOTER_COLUMNS,
  FOOTER_LEGAL,
  FOOTER_LEGAL_LINKS,
  FOOTER_NEWSLETTER,
  FOOTER_SERVICE_LINKS,
  FOOTER_SOLO_OPERATOR_NOTE,
  FOOTER_TAGLINE,
} from '../content/nav';
import { COMMUNITY, SITE } from '../content/site';
import { NewsletterSignup } from './NewsletterSignup';

export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-muted py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Brand + secondary pathways */}
          <div className="space-y-6 lg:col-span-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight text-foreground">
                <img src="/icon-mark.svg" alt="" aria-hidden="true" className="h-7 w-7" />
                {SITE.brand}
              </div>
              <p className="max-w-sm text-sm font-medium leading-6 text-foreground">
                {SITE.brandTagline}
              </p>
              {/* Type ladder: multi-sentence product line is body, not meta. */}
              <p className="max-w-sm text-sm leading-6 text-body">{FOOTER_TAGLINE}</p>
            </div>

            <div className="space-y-2">
              <p className="max-w-sm text-xs leading-6 text-muted-foreground">
                {FOOTER_SOLO_OPERATOR_NOTE}
              </p>
              <p className="max-w-sm text-xs leading-6 text-muted-foreground">
                {FOOTER_CLAIMS_LEDGER_NOTE.prefix}{' '}
                <a
                  href={FOOTER_CLAIMS_LEDGER_NOTE.href}
                  className="font-medium text-primary hover:underline"
                >
                  {FOOTER_CLAIMS_LEDGER_NOTE.linkLabel}
                </a>
              </p>
              {FOOTER_SERVICE_LINKS.map((item) => (
                <p key={item.label} className="max-w-sm text-xs leading-6 text-muted-foreground">
                  {item.prefix}{' '}
                  <a href={item.href} className="font-medium text-primary hover:underline">
                    {item.label}
                  </a>
                </p>
              ))}
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {FOOTER_NEWSLETTER.heading}
              </p>
              <NewsletterSignup />
              <p className="mt-2 text-xs text-muted-foreground">{FOOTER_NEWSLETTER.body}</p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <a
                href={SITE.urls.repo}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="GitHub"
              >
                <GitHubIcon className="size-5" />
              </a>
              <a
                href={SITE.urls.linkedin}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="RevealUI on LinkedIn"
              >
                <LinkedInIcon className="size-5" />
              </a>
              {COMMUNITY.substack.url ? (
                <a
                  href={COMMUNITY.substack.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Substack
                </a>
              ) : null}
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7 lg:gap-8">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.heading}>
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {col.heading}
                </h3>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {col.links.map(({ label, href, external }) => (
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
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-start">
            <p>
              &copy; {currentYear} RevealUI is operated by{' '}
              <a
                href={FOOTER_LEGAL.operatorHref}
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {FOOTER_LEGAL.operator}
              </a>{' '}
              ({FOOTER_LEGAL.jurisdiction}). All rights reserved.
            </p>
            <BuiltWithRevealUI size="sm" />
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {FOOTER_LEGAL_LINKS.map(({ label, href }) => (
              <a key={label} href={href} className="transition-colors hover:text-foreground">
                {label}
              </a>
            ))}
            <CookieSettingsButton className="transition-colors hover:text-foreground" />
          </div>
        </div>
      </div>
    </footer>
  );
}
