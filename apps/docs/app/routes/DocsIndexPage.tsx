import { ReceiptCard } from '@revealui/presentation';
import { Link } from '@revealui/router';
import { useEffect } from 'react';
import {
  DOCS_RECEIPT_CAPTION,
  DOCS_RECEIPT_INTEGRITY,
  DOCS_RECEIPT_LINES,
  DOCS_RECEIPT_TITLE,
} from '../content/receipt';
import { applyDocHead } from '../lib/head';
import { renderMarkdown } from '../utils/markdown';

export function DocsIndexPage() {
  // Restore the site-default head after per-page overrides (SPA navigation).
  useEffect(() => {
    applyDocHead();
  }, []);

  const content = `# RevealUI Documentation

Agentic business runtime. People, Content, Offers, Payments, and Agents come pre-wired, open source, and ready to deploy. Self-host today. RevealUI Cloud is waitlist, not sold.

## Quick Start

\`\`\`bash
npx create-revealui@latest my-app
cd my-app
# review .env.development.local (created by the scaffolder)
pnpm db:migrate
pnpm dev
\`\`\`

Open [http://localhost:4000/admin](http://localhost:4000/admin) to see the admin dashboard.

[**Read the Quick Start guide**](/quick-start) for the full walkthrough.

## Next steps

- [Build Your Business](/build-your-business) walks the whole path from scaffold to deploy.
- [Examples](/examples) are complete starters: a blog, a subscription app, and a storefront.
- [REST API](/api/rest-api) is the OpenAPI reference for every endpoint.

Everything else lives in the sidebar. Found a gap in these docs? See the [Contributing Guide](https://github.com/RevealUIStudio/revealui/blob/main/CONTRIBUTING.md).
`;

  return (
    <div>
      {/*
        Static receipt header artifact (frontend-excellence Phase 5 / GAP-480 Phase D).
        No animate: docs stay the calmest surface. Links to audit-receipts docs.
      */}
      <div className="mx-auto w-full max-w-[var(--width-content)] px-8 pt-10">
        <div className="w-full max-w-md min-w-0">
          <ReceiptCard
            title={DOCS_RECEIPT_TITLE}
            lines={[...DOCS_RECEIPT_LINES]}
            integrity={DOCS_RECEIPT_INTEGRITY}
          />
          <p className="mt-3 text-sm text-text-muted">
            {DOCS_RECEIPT_CAPTION.text}{' '}
            <Link
              to={DOCS_RECEIPT_CAPTION.link.href}
              className="font-semibold text-ink underline-offset-4 hover:underline"
            >
              {DOCS_RECEIPT_CAPTION.link.label}
            </Link>
          </p>
        </div>
      </div>
      {renderMarkdown(content)}
    </div>
  );
}
