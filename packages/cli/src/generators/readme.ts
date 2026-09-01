/**
 * Project README generator
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectConfig, ProjectTemplate } from '../prompts/project.js';

const VERCEL_CLONE_ORIGIN = 'https://vercel.com/new/clone';

const VERCEL_DEPLOY_REQUIRED_ENV = [
  'POSTGRES_URL',
  'REVEALUI_SECRET',
  'REVEALUI_PUBLIC_SERVER_URL',
  'NEXT_PUBLIC_SERVER_URL',
] as const;

const NEXT_GITHUB_TWINS: Partial<Record<ProjectTemplate, string>> = {
  'basic-blog': 'https://github.com/RevealUIStudio/revealui-template-basic-blog',
  'e-commerce': 'https://github.com/RevealUIStudio/revealui-template-e-commerce',
  portfolio: 'https://github.com/RevealUIStudio/revealui-template-portfolio',
  starter: 'https://github.com/RevealUIStudio/revealui-template-starter',
};

function vercelDeployHref(githubHref: string, projectName: string): string {
  const url = new URL(VERCEL_CLONE_ORIGIN);
  url.searchParams.set('repository-url', githubHref);
  url.searchParams.set('project-name', projectName);
  url.searchParams.set('repository-name', projectName);
  url.searchParams.set('env', VERCEL_DEPLOY_REQUIRED_ENV.join(','));
  url.searchParams.set(
    'envDescription',
    'Your Postgres URL (Neon or any Postgres) and RevealUI runtime secrets. This is your Vercel project and your database.',
  );
  return url.toString();
}

function deploySection(template: ProjectTemplate): string {
  const githubHref = NEXT_GITHUB_TWINS[template];
  if (!githubHref) {
    return `## Deploy

No GitHub Use this template twin. Scaffold with \`npx create-revealui@latest --template ${template}\`, then deploy from that directory with the Vercel CLI. You bring your own Neon or Postgres (\`POSTGRES_URL\`).
`;
  }

  const href = vercelDeployHref(githubHref, `revealui-${template}`);
  return `## Deploy to Vercel

This is the runtime deploy path: your Vercel account and your Neon or Postgres. It is not a Studio SKU and not a Starter Kit.

[![Deploy with Vercel](https://vercel.com/button)](${href})

Required env on the clone form: \`${VERCEL_DEPLOY_REQUIRED_ENV.join('`, `')}\`. After the first deploy, set the two public URL vars to the Vercel URL and redeploy. Optional later: Cloudflare R2 for media, Stripe for checkout.

There is no live vercel.com/templates listing URL. The official marketplace submit is an owner dashboard step.
`;
}

export async function generateReadme(
  projectPath: string,
  projectConfig: ProjectConfig,
): Promise<void> {
  const readme = `# ${projectConfig.projectName}

A RevealUI project created with @revealui/cli.

## Getting Started

First, install dependencies:

\`\`\`bash
pnpm install
\`\`\`

Then, initialize the database:

\`\`\`bash
pnpm db:init
pnpm db:migrate
\`\`\`

Run the development server:

\`\`\`bash
pnpm dev
\`\`\`

Open [http://localhost:4000](http://localhost:4000) with your browser.

## Requirements

- Node.js 24.13.0 or higher
- pnpm 10 or higher
- PostgreSQL 16 (or use a hosted provider like [Neon](https://neon.tech))

## Project Structure

\`\`\`
${projectConfig.projectName}/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── collections/      # RevealUI collection definitions
│   └── seed.ts           # Database seed script
├── revealui.config.ts    # RevealUI configuration
├── next.config.mjs       # Next.js configuration
├── vercel.json           # Vercel project settings for this app
└── .env.development.local # Environment variables (git-ignored)
\`\`\`

## Available Scripts

- \`pnpm dev\` - Start the development server
- \`pnpm build\` - Build for production
- \`pnpm test\` - Run tests
- \`pnpm lint\` - Lint with Biome
- \`pnpm typecheck\` - Type check
- \`pnpm db:init\` - Initialize the database
- \`pnpm db:migrate\` - Run migrations
- \`pnpm db:seed\` - Seed sample content

${deploySection(projectConfig.template)}
## Learn More

- [RevealUI Documentation](https://docs.revealui.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [Deployment guide](https://docs.revealui.com/guides/deployment)

## Template

This project was created using the **${projectConfig.template}** template.

## License

MIT
`;

  await fs.writeFile(path.join(projectPath, 'README.md'), readme, 'utf-8');
}
