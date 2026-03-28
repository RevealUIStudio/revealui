/**
 * Project README generator
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectConfig } from '../prompts/project.js';

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
└── .env.local            # Environment variables (git-ignored)
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

## Learn More

- [RevealUI Documentation](https://docs.revealui.com)
- [Next.js Documentation](https://nextjs.org/docs)

## Template

This project was created using the **${projectConfig.template}** template.

## License

MIT
`;

  await fs.writeFile(path.join(projectPath, 'README.md'), readme, 'utf-8');
}
