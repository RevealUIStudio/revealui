# OpenCode Docker Server

Run OpenCode (AI coding agent) in a Docker container on your own server.

## Quick Start

```bash
# 1. Navigate to the OpenCode server directory
cd infrastructure/opencode-server

# 2. Set up environment
cp .env.template .env
# Edit .env with your API keys

# 3. Build and run
DOCKER_BUILDKIT=1 docker-compose build
docker-compose run --rm opencode
```

## Configuration

Create a `.env` file:

```env
# AI Provider API Keys (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Project path (where your code lives)
PROJECT_PATH=/path/to/your/project

# Git configuration
GIT_USER_NAME=Your Name
GIT_USER_EMAIL=your@email.com

# SSH keys path (for git operations)
SSH_KEY_PATH=~/.ssh
```

## Usage

### Interactive Mode (Recommended)

```bash
# Start interactive OpenCode session
docker-compose run --rm opencode

# Or with specific project
docker-compose run --rm -v /path/to/project:/workspace opencode
```

### One-off Commands

```bash
# Run a specific command
docker-compose run --rm opencode opencode --help

# Analyze a project
docker-compose run --rm opencode opencode analyze /workspace

# Run tests
docker-compose run --rm opencode opencode test /workspace
```

### Shell Access

```bash
# Get bash shell inside container
docker-compose run --rm opencode shell

# Or
docker exec -it opencode-server /bin/bash
```

## Docker Commands

### Build
```bash
DOCKER_BUILDKIT=1 docker build -t opencode-server .
```

### Run
```bash
# Interactive
docker run -it --rm \
  -v $(pwd):/workspace \
  -v ~/.ssh:/home/opencode/.ssh:ro \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  opencode-server

# Background (not typical for CLI tool)
docker run -d --name opencode \
  -v $(pwd):/workspace \
  opencode-server opencode --watch
```

## Advanced Usage

### Custom Entrypoint

Create custom scripts in `scripts/` directory:

```bash
# scripts/analyze.sh
docker-compose run --rm opencode opencode analyze /workspace --deep

# scripts/fix.sh  
docker-compose run --rm opencode opencode fix /workspace --auto
```

### Multiple Projects

```yaml
# docker-compose.override.yml
services:
  opencode-project1:
    extends:
      file: docker-compose.yml
      service: opencode
    volumes:
      - /path/to/project1:/workspace
    
  opencode-project2:
    extends:
      file: docker-compose.yml
      service: opencode
    volumes:
      - /path/to/project2:/workspace
```

### API Mode (Custom Implementation)

**Note:** OpenCode is a CLI tool. To expose it as an API, you'd need to build a wrapper:

```javascript
// Example API wrapper (not included)
const express = require('express');
const { exec } = require('child_process');

app.post('/analyze', (req, res) => {
  exec('opencode analyze /workspace', (err, stdout) => {
    res.json({ output: stdout });
  });
});
```

## Security Considerations

1. **API Keys**: Never commit `.env` file
2. **SSH Keys**: Mounted read-only (`:ro`)
3. **Non-root user**: Container runs as `opencode` user (UID 1000)
4. **Network isolation**: Container on isolated network

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs opencode

# Verify environment
docker-compose config
```

### Permission issues
```bash
# Fix ownership
sudo chown -R 1000:1000 /path/to/project

# Or run as current user
docker-compose run --rm -u $(id -u):$(id -g) opencode
```

### API key not working
```bash
# Verify key is set
docker-compose run --rm opencode env | grep API_KEY
```

## Integration with RevealUI

To use OpenCode with your RevealUI project:

```bash
# From RevealUI root
cd infrastructure/opencode-server

# Create .env with your project path
cat > .env << EOF
PROJECT_PATH=/path/to/RevealUI
OPENAI_API_KEY=sk-...
EOF

# Run OpenCode on RevealUI
docker-compose run --rm opencode
```

## Maintenance

### Update OpenCode
```bash
# Rebuild to get latest version
DOCKER_BUILDKIT=1 docker-compose build --no-cache
```

### Clean up
```bash
# Remove containers and volumes
docker-compose down -v

# Remove images
docker rmi opencode-server
```

## Architecture

```
┌─────────────────┐
│   Your Server   │
│  (Docker Host)  │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Docker  │
    │ Container│
    │          │
    │ ┌──────┐│
    │ │OpenCode│
    │ │ CLI   ││
    │ └──────┘│
    │          │
    │ /workspace│ (mounted volume)
    └─────────┘
```

## Support

- OpenCode Docs: https://opencode.ai/docs
- GitHub: https://github.com/anomalyco/opencode
- Issues: Check container logs first