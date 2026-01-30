# OpenCode Docker Server Setup
# This runs OpenCode CLI tool in a containerized environment

FROM node:22-alpine

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    bash \
    openssh-client \
    ca-certificates \
    gnupg \
    python3 \
    py3-pip \
    make \
    g++

# Create non-root user for security
RUN addgroup -g 1000 opencode && \
    adduser -u 1000 -G opencode -s /bin/bash -D opencode

# Install OpenCode
RUN curl -fsSL https://opencode.ai/install | bash

# Ensure opencode is in PATH
ENV PATH="/root/.local/bin:${PATH}"

# Create workspace directory
RUN mkdir -p /workspace && chown -R opencode:opencode /workspace

# Set working directory
WORKDIR /workspace

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER opencode

# Default command
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["opencode"]