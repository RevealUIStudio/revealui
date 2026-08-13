import { Badge, Callout, CodeBlock, Divider, MarketingSection } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import {
  CLAIMS_COUNTS_LABELS,
  CLAIMS_HERO,
  CLAIMS_HONESTY_RAILS_SECTION,
  CLAIMS_KIND_LEGEND,
  CLAIMS_LEDGER_INTRO,
  CLAIMS_RECEIPT_HOLD_NOTE,
  CLAIMS_SIGNED_LEDGER_NOTE,
} from '../content/claims';
import {
  CLAIMS,
  type ClaimEntry,
  COVERED_FILES,
  type EvidenceKind,
} from '../content/claims-evidence';
import { CONTENT_FILE_ROUTES, routeDepth } from '../content/claims-routes';
import { SITE } from '../content/site';
import { BLOG_POST_METADATA } from '../lib/blog-registry';

/** One accent color throughout (locked design point 10): every kind badge
 *  reads "brand" (the Cobalt primary token). Kinds are told apart by label. */
const KIND_BADGE_COLOR = 'brand' as const;

// Partial + fallback so a future EvidenceKind renders its raw kind as the
// badge instead of breaking the build or showing an empty badge before the
// legend copy catches up.
const KIND_LABEL: Partial<Record<EvidenceKind, string>> = Object.fromEntries(
  CLAIMS_KIND_LEGEND.map((entry) => [entry.kind, entry.label]),
);

function codeHref(ref: string): string {
  return `${SITE.urls.repo}/blob/main/${ref}`;
}

function anchorId(file: string): string {
  return file.endsWith('.ts') ? file.slice(0, -3) : file;
}

/** A `kind: 'test'` ref is "<repo-relative test file>#<exact test title>". */
function splitTestRef(ref: string): { readonly file: string; readonly title: string } {
  const hashIndex = ref.indexOf('#');
  if (hashIndex === -1) return { file: ref, title: '' };
  return { file: ref.slice(0, hashIndex), title: ref.slice(hashIndex + 1) };
}

function TestRefLink({ testRef }: { testRef: string }) {
  const { file, title } = splitTestRef(testRef);
  return (
    <span className="break-all">
      <a
        href={codeHref(file)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
      >
        {file}
      </a>
      {title && <span className="text-muted-foreground">#{title}</span>}
    </span>
  );
}

interface FileSection {
  readonly file: string;
  readonly route: string;
  readonly pageTitle: string;
  readonly claims: readonly ClaimEntry[];
}

// One section per covered content file (locked design point 3), ordered by
// the depth of the route it proves — the file mapping to "/" comes first.
// COVERED_FILES already lists home.ts before deeper pages, so a stable sort
// on depth alone preserves that order among ties.
// GAP-467: append live blog posts (title+excerpt index) after product/legal.
const CONTENT_FILE_SECTIONS: readonly FileSection[] = COVERED_FILES.map((covered) => {
  // Guaranteed present by the validate:claims-evidence route-map assertion
  // (scripts/validate/claims-evidence.ts check 4); the fallback only matters
  // for a local dev build made before that gate has run.
  const routeEntry = CONTENT_FILE_ROUTES[covered.file];
  return {
    file: covered.file,
    route: routeEntry?.route ?? '/',
    pageTitle: routeEntry?.pageTitle ?? covered.file,
    claims: CLAIMS.filter((claim) => claim.file === covered.file),
  };
})
  .slice()
  .sort((a, b) => routeDepth(a.route) - routeDepth(b.route));

const BLOG_FILE_SECTIONS: readonly FileSection[] = BLOG_POST_METADATA.map((post) => {
  const file = `blog/${post.slug}`;
  return {
    file,
    route: `/blog/${post.slug}`,
    pageTitle: post.title,
    claims: CLAIMS.filter((claim) => claim.file === file),
  };
});

const FILE_SECTIONS: readonly FileSection[] = [...CONTENT_FILE_SECTIONS, ...BLOG_FILE_SECTIONS];

/** Content modules + live blog posts represented on this ledger. */
const LEDGER_SURFACE_COUNT = COVERED_FILES.length + BLOG_POST_METADATA.length;

function EvidenceRow({ evidence }: { evidence: ClaimEntry['evidence'][number] }) {
  return (
    <li className="flex flex-wrap items-start gap-x-2 gap-y-1 border-t border-dashed border-border py-2 font-mono text-xs">
      <Badge color={KIND_BADGE_COLOR}>{KIND_LABEL[evidence.kind] ?? evidence.kind}</Badge>
      {evidence.kind === 'command' ? (
        <div className="w-full pt-1">
          <CodeBlock code={evidence.ref} language="bash" />
        </div>
      ) : evidence.kind === 'code' || evidence.kind === 'metric' ? (
        <a
          href={codeHref(evidence.ref)}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
        >
          {evidence.ref}
        </a>
      ) : evidence.kind === 'url' ? (
        <a
          href={evidence.ref}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-primary underline decoration-primary/40 underline-offset-4 hover:text-primary/80"
        >
          {evidence.ref}
        </a>
      ) : evidence.kind === 'test' ? (
        <TestRefLink testRef={evidence.ref} />
      ) : (
        // Future evidence kinds render as plain text until the page grows a
        // dedicated treatment. Never emit an unknown ref as href.
        <span className="break-all">{evidence.ref}</span>
      )}
      {evidence.note && (
        <span className="w-full font-sans text-muted-foreground">{evidence.note}</span>
      )}
    </li>
  );
}

function ClaimRow({
  claim,
  pageTitle,
  route,
}: {
  claim: ClaimEntry;
  pageTitle: string;
  route: string;
}) {
  return (
    <li className="py-5 sm:py-6" data-testid="claim-row">
      <p className="text-sm leading-6 text-foreground">{claim.text}</p>
      <p className="mt-1.5 font-mono text-xs text-muted-foreground">
        Proves{' '}
        <a href={route} className="text-primary hover:text-primary/80">
          {pageTitle}
        </a>{' '}
        &middot; {claim.exportPath}
      </p>
      <ul className="mt-2.5">
        {claim.evidence.map((ev, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: evidence refs carry no stable id of their own
          <EvidenceRow key={`${claim.exportPath}-${i}`} evidence={ev} />
        ))}
      </ul>
    </li>
  );
}

export function ClaimsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 pt-24 pb-10 sm:pb-12 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            {CLAIMS_HERO.eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {CLAIMS_HERO.h1}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-body">{CLAIMS_HERO.subtitle}</p>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 font-mono text-sm tabular-nums text-foreground">
            <span>
              <strong className="font-semibold">{CLAIMS.length}</strong>{' '}
              {CLAIMS_COUNTS_LABELS.entriesLabel}
            </span>
            <span>
              <strong className="font-semibold">{LEDGER_SURFACE_COUNT}</strong>{' '}
              {CLAIMS_COUNTS_LABELS.filesLabel}
            </span>
          </div>
        </div>
      </header>

      <MarketingSection
        tone="background"
        density="compact"
        width="narrow"
        className="border-b border-border"
      >
        <div className="space-y-4">
          <Callout variant="info" title={CLAIMS_SIGNED_LEDGER_NOTE.heading}>
            <p>{CLAIMS_SIGNED_LEDGER_NOTE.body}</p>
          </Callout>
          <Callout variant="info" title={CLAIMS_RECEIPT_HOLD_NOTE.heading}>
            <p>{CLAIMS_RECEIPT_HOLD_NOTE.body}</p>
          </Callout>
        </div>
      </MarketingSection>

      <MarketingSection
        tone="secondary"
        density="compact"
        width="narrow"
        className="border-b border-border"
      >
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CLAIMS_KIND_LEGEND.map((entry) => (
            <div key={entry.kind} className="flex items-start gap-3">
              <Badge color={KIND_BADGE_COLOR} className="mt-0.5 shrink-0">
                {entry.label}
              </Badge>
              <dd className="text-sm text-body">{entry.description}</dd>
            </div>
          ))}
        </dl>
      </MarketingSection>

      <nav aria-label="Sections" className="border-b border-border px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-sm leading-6 text-body">{CLAIMS_LEDGER_INTRO}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-xs">
            {FILE_SECTIONS.map((section) => (
              <li key={section.file}>
                <a
                  href={`#${anchorId(section.file)}`}
                  className="text-primary hover:text-primary/80"
                >
                  {section.pageTitle}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* RootLayout already supplies the page's <main> landmark; use a div here
       * to avoid nesting <main> elements (invalid HTML, duplicate a11y landmark). */}
      <div className="px-6 py-4 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {FILE_SECTIONS.map((section, i) => (
            <section
              key={section.file}
              id={anchorId(section.file)}
              aria-labelledby={`${anchorId(section.file)}-heading`}
              className="py-7 sm:py-8"
            >
              <h2
                id={`${anchorId(section.file)}-heading`}
                className="text-xl font-semibold tracking-tight text-foreground"
              >
                {section.pageTitle}
              </h2>
              <p className="mt-1.5 font-mono text-xs text-muted-foreground">
                <a href={section.route} className="text-primary hover:text-primary/80">
                  {section.route}
                </a>{' '}
                &middot; sourced from{' '}
                <code className="rounded bg-muted px-1 py-0.5">
                  apps/marketing/app/content/{section.file}
                </code>
              </p>
              {section.claims.length === 0 ? (
                <p className="mt-4 text-sm text-body">No indexed claims yet for this file.</p>
              ) : (
                <ol className="mt-5 divide-y divide-border">
                  {section.claims.map((claim) => (
                    <ClaimRow
                      key={claim.exportPath}
                      claim={claim}
                      pageTitle={section.pageTitle}
                      route={section.route}
                    />
                  ))}
                </ol>
              )}
              {i < FILE_SECTIONS.length - 1 && <Divider soft className="mt-6 sm:mt-8" />}
            </section>
          ))}
        </div>
      </div>

      <MarketingSection
        tone="secondary"
        density="compact"
        width="narrow"
        className="border-t border-border"
      >
        <div className="space-y-4">
          <Callout variant="info" title={CLAIMS_HONESTY_RAILS_SECTION.heading}>
            <p>{CLAIMS_HONESTY_RAILS_SECTION.intro}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {CLAIMS_HONESTY_RAILS_SECTION.checks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </Callout>
          <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
            <p className="text-sm font-semibold text-foreground">
              {CLAIMS_HONESTY_RAILS_SECTION.notCheckedHeading}
            </p>
            <div className="mt-1 space-y-1 text-sm text-body">
              {CLAIMS_HONESTY_RAILS_SECTION.doesNotCheck.map((sentence) => (
                <p key={sentence}>{sentence}</p>
              ))}
            </div>
          </div>
        </div>
      </MarketingSection>

      <Footer />
    </div>
  );
}
