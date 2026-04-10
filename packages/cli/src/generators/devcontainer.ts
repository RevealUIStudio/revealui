/**
 * Dev Container configuration generator
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export async function generateDevContainer(projectPath: string): Promise<void> {
  const devcontainerDir = path.join(projectPath, '.devcontainer');
  await fs.mkdir(devcontainerDir, { recursive: true });

  // Create devcontainer.json
  const devcontainerConfig = {
    name: 'RevealUI Development',
    image: 'mcr.microsoft.com/devcontainers/typescript-node:24',
    features: {
      'ghcr.io/devcontainers/features/common-utils:2': {
        installZsh: true,
        installOhMyZsh: true,
      },
    },
    forwardPorts: [3000, 4000, 5432],
    portsAttributes: {
      '3000': {
        label: 'Web App',
        onAutoForward: 'notify',
      },
      '4000': {
        label: 'Admin',
        onAutoForward: 'notify',
      },
      '5432': {
        label: 'PostgreSQL',
        onAutoForward: 'silent',
      },
    },
    postCreateCommand: 'corepack enable && pnpm install',
    customizations: {
      vscode: {
        extensions: [
          'biomejs.biome',
          'bradlc.vscode-tailwindcss',
          'Prisma.prisma',
          'ms-azuretools.vscode-docker',
          'streetsidesoftware.code-spell-checker',
        ],
        settings: {
          'editor.defaultFormatter': 'biomejs.biome',
          'editor.formatOnSave': true,
          'editor.codeActionsOnSave': {
            'quickfix.biome': 'explicit',
            'source.organizeImports.biome': 'explicit',
          },
        },
      },
    },
    remoteUser: 'node',
  };

  await fs.writeFile(
    path.join(devcontainerDir, 'devcontainer.json'),
    JSON.stringify(devcontainerConfig, null, 2),
    'utf-8',
  );

  // Create docker-compose.yml for services
  const dockerCompose = `version: '3.8'

services:
  app:
    build:
      context: ..
      dockerfile: .devcontainer/Dockerfile
    volumes:
      - ..:/workspace:cached
    command: sleep infinity
    network_mode: service:db

  db:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: revealui
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
`;

  await fs.writeFile(path.join(devcontainerDir, 'docker-compose.yml'), dockerCompose, 'utf-8');

  // Create Dockerfile
  const dockerfile = `FROM mcr.microsoft.com/devcontainers/typescript-node:24

# Install additional tools
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \\
    && apt-get -y install --no-install-recommends postgresql-client

# Enable pnpm
RUN corepack enable
`;

  await fs.writeFile(path.join(devcontainerDir, 'Dockerfile'), dockerfile, 'utf-8');

  // Create README
  const readme = `# Dev Container Setup

This directory contains the Dev Container configuration for RevealUI.

## Usage

### VS Code

1. Install the "Dev Containers" extension
2. Open this folder in VS Code
3. Press F1 and select "Dev Containers: Reopen in Container"

### GitHub Codespaces

1. Click the green "Code" button on GitHub
2. Select "Codespaces" tab
3. Click "Create codespace on main"

## What's Included

- Node.js 24.13.0
- pnpm package manager
- PostgreSQL 16 with pgvector
- VS Code extensions:
  - Biome
  - Tailwind CSS
  - Prisma
  - Docker
  - Code Spell Checker

## Environment Variables

Environment variables are loaded from \`.env.development.local\`.
For GitHub Codespaces, set secrets in your repository settings.

## Ports

- 3000: Web application
- 4000: Admin
- 5432: PostgreSQL database
`;

  await fs.writeFile(path.join(devcontainerDir, 'README.md'), readme, 'utf-8');
}
