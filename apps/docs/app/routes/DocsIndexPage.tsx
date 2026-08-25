import { useEffect } from 'react';
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

  return <div>{renderMarkdown(content)}</div>;
}
