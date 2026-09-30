import { useEffect } from 'react';
import { applyDocHead } from '../lib/head';
import { renderMarkdown } from '../utils/markdown';

export function DocsIndexPage() {
  // Restore the site-default head after per-page overrides (SPA navigation).
  useEffect(() => {
    applyDocHead();
  }, []);

  const content = `# RevealUI Documentation

Find the setup guides, configuration reference, and API documentation for your self-hosted runtime. Start with the guide for your chosen template.

## Quick Start

\`\`\`bash
npx create-revealui@latest my-app
cd my-app
# review .env.development.local (created by the scaffolder)
pnpm db:migrate
pnpm dev
\`\`\`

Follow the setup guide for your template to find its local app and admin URLs.

[**Read the Quick Start guide**](/quick-start) for the full walkthrough.

## Next steps

- [Build Your Business](/build-your-business) walks the whole path from scaffold to deploy.
- [Examples](/examples) are complete starters: a blog, a subscription app, and a storefront.
- [REST API](/api/rest-api) is the OpenAPI reference for every endpoint.

Everything else lives in the sidebar. Found a gap in these docs? See the [Contributing Guide](https://github.com/RevealUIStudio/revealui/blob/main/CONTRIBUTING.md).
`;

  // Governed-action ReceiptCard lives on the marketing home, not this index.
  return <div>{renderMarkdown(content)}</div>;
}
