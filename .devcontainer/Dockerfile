FROM mcr.microsoft.com/devcontainers/typescript-node:24-bookworm

# Install additional system dependencies
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
        postgresql-client \
        git \
        curl \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm (version managed by packageManager field in package.json)
RUN npm install -g pnpm@10.28.2

USER node
