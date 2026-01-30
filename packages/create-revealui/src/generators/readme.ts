/**
 * Project README generator
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { ProjectConfig } from '../prompts/project.js'

export async function generateReadme(
  projectPath: string,
  projectConfig: ProjectConfig
): Promise<void> {
  const readme = `# ${projectConfig.projectName}

A RevealUI project created with create-revealui.

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

Open [http://localhost:4000](http://localhost:4000) with your browser to access the CMS.

The web application runs on [http://localhost:3000](http://localhost:3000).

## Development Environments

### Standard Setup

Requirements:
- Node.js 24.12.0 or higher
- pnpm 10.28.2 or higher
- PostgreSQL 16

### Dev Containers

Open in VS Code and select "Reopen in Container", or use GitHub Codespaces.

### Devbox

Install Devbox:

\`\`\`bash
curl -fsSL https://get.jetpack.io/devbox | bash
\`\`\`

Then start the Devbox shell:

\`\`\`bash
devbox shell
pnpm dev
\`\`\`

## Project Structure

\`\`\`
${projectConfig.projectName}/
├── apps/
│   ├── cms/              # CMS application
│   └── web/              # Frontend application
├── packages/
│   ├── auth/             # Authentication
│   ├── db/               # Database
│   └── ...               # Other shared packages
├── .devcontainer/        # Dev Container configuration
├── devbox.json           # Devbox configuration
└── .env.development.local # Environment variables
\`\`\`

## Available Scripts

- \`pnpm dev\` - Start development servers
- \`pnpm build\` - Build for production
- \`pnpm test\` - Run tests
- \`pnpm lint\` - Run linters
- \`pnpm typecheck\` - Type check
- \`pnpm db:init\` - Initialize database
- \`pnpm db:migrate\` - Run migrations
- \`pnpm db:seed\` - Seed database

## Learn More

- [RevealUI Documentation](https://github.com/your-org/RevealUI)
- [Next.js Documentation](https://nextjs.org/docs)
- [Hono Documentation](https://hono.dev)

## Template

This project was created using the **${projectConfig.template}** template.

## License

MIT
`

  await fs.writeFile(
    path.join(projectPath, 'README.md'),
    readme,
    'utf-8'
  )
}
