import { BuiltWithRevealUI, GitHubIcon, LinkedInIcon } from '@revealui/presentation';
import {
  FOOTER_CLAIMS_LEDGER_NOTE,
  FOOTER_COLUMNS,
  FOOTER_LEGAL,
  FOOTER_LEGAL_LINKS,
  FOOTER_SERVICE_LINKS,
  FOOTER_SOLO_OPERATOR_NOTE,
  FOOTER_TAGLINE,
} from '../content/nav';
import { COMMUNITY, SITE } from '../content/site';
import { NewsletterSignup } from './NewsletterSignup';

export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-muted border-t border-border py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight text-foreground mb-4">
              <img src="/icon-mark.svg" alt="" aria-hidden="true" className="h-7 w-7" />
              {SITE.brand}
            </div>
            <p className="text-foreground text-sm font-medium leading-6 max-w-sm">
              {SITE.brandTagline}
            </p>
            <p className="text-muted-foreground text-sm leading-6 max-w-sm mt-2">
              {FOOTER_TAGLINE}
            </p>
            <p className="text-muted-foreground text-xs leading-6 max-w-sm mt-3">
              {FOOTER_SOLO_OPERATOR_NOTE}
            </p>
            <p className="text-muted-foreground text-xs leading-6 max-w-sm mt-3">
              {FOOTER_CLAIMS_LEDGER_NOTE.prefix}{' '}
              <a
                href={FOOTER_CLAIMS_LEDGER_NOTE.href}
                className="font-medium text-primary hover:underline"
              >
                {FOOTER_CLAIMS_LEDGER_NOTE.linkLabel}
              </a>
            </p>
            <div className="mt-3 space-y-1">
              {FOOTER_SERVICE_LINKS.map((item) => (
                <p key={item.label} className="text-muted-foreground text-xs leading-6">
                  {item.prefix}{' '}
                  <a href={item.href} className="font-medium text-primary hover:underline">
                    {item.label}
                  </a>
                </p>
              ))}
            </div>
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Stay in the loop
              </p>
              <NewsletterSignup />
              <p className="mt-2 text-xs text-muted-foreground">
                Product updates and engineering insights. No spam.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <a
                href={SITE.urls.repo}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="GitHub"
              >
                <GitHubIcon className="size-5" />
              </a>
              <a
                href={SITE.urls.linkedin}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="RevealUI on LinkedIn"
              >
                <LinkedInIcon className="size-5" />
              </a>
              {COMMUNITY.substack.url ? (
                <a
                  href={COMMUNITY.substack.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Substack
                </a>
              ) : null}
            </div>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                {col.heading}
              </h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {col.links.map(({ label, href, external }) => (
                  <li key={label}>
                    <a
                      href={href}
                      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="hover:text-foreground transition-colors"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-muted-foreground text-sm">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-start">
            <p>
              &copy; {currentYear} RevealUI is operated by{' '}
              <a
                href={FOOTER_LEGAL.operatorHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
              >
                {FOOTER_LEGAL.operator}
              </a>{' '}
              ({FOOTER_LEGAL.jurisdiction}). All rights reserved.
            </p>
            <BuiltWithRevealUI size="sm" />
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {FOOTER_LEGAL_LINKS.map(({ label, href }) => (
              <a key={label} href={href} className="hover:text-foreground transition-colors">
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
