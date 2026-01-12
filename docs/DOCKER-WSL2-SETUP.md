# Docker Engine Setup on WSL2 (Without Docker Desktop)

**Purpose**: Set up Docker Engine directly on WSL2 without Docker Desktop  
**OS**: WSL2 (Ubuntu/Debian)  
**Date**: January 2025

---

## Overview

Docker Desktop is heavy and requires Windows. You can run Docker Engine directly on WSL2, which is lighter and faster.

---

## Prerequisites

- WSL2 installed and running
- Ubuntu/Debian distribution in WSL2
- Sudo access

---

## Installation Steps

### Step 1: Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### Step 2: Install Prerequisites

```bash
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release
```

### Step 3: Add Docker's Official GPG Key

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

### Step 4: Set Up Docker Repository

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### Step 5: Install Docker Engine

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Step 6: Start Docker Service

```bash
sudo service docker start
```

### Step 7: Add Your User to Docker Group (Optional but Recommended)

```bash
sudo usermod -aG docker $USER
```

**Important**: You'll need to log out and log back in (or restart WSL) for group changes to take effect.

### Step 8: Verify Installation

```bash
docker --version
docker compose version
sudo docker run hello-world
```

---

## Auto-Start Docker on WSL2

Docker doesn't auto-start on WSL2. Add this to your `~/.bashrc` or `~/.zshrc`:

```bash
# Auto-start Docker on WSL2
if ! pgrep -x "dockerd" > /dev/null; then
    sudo service docker start > /dev/null 2>&1
fi
```

Or create a systemd service (if you have systemd enabled in WSL2):

```bash
# Check if systemd is enabled
systemctl --version

# If systemd is available, enable Docker service
sudo systemctl enable docker
sudo systemctl start docker
```

---

## Fix Docker Credential Issue

If you see the credential error, remove the credential helper:

```bash
# Check Docker config
cat ~/.docker/config.json

# Remove credential helper (if present)
# Edit ~/.docker/config.json and remove:
#   "credsStore": "desktop.exe"
#   or
#   "credHelpers": { ... }
```

Or create/update `~/.docker/config.json`:

```json
{
  "auths": {}
}
```

---

## Verify Setup

```bash
# Check Docker is running
sudo service docker status

# Test Docker
docker ps

# Test Docker Compose
docker compose version

# Test with our test database
cd /home/joshua-v-dev/projects/RevealUI
docker compose -f docker-compose.test.yml up -d
docker compose -f docker-compose.test.yml ps
docker compose -f docker-compose.test.yml down
```

---

## Troubleshooting

### Docker Service Not Starting

```bash
# Check Docker service status
sudo service docker status

# Start Docker manually
sudo service docker start

# Check logs
sudo journalctl -u docker
# or
sudo tail -f /var/log/docker.log
```

### Permission Denied

```bash
# Add user to docker group (if not done)
sudo usermod -aG docker $USER

# Log out and back in, or restart WSL
# Then verify:
groups
# Should include "docker"
```

### Port Already in Use

```bash
# Check what's using the port
sudo netstat -tulpn | grep 5433

# Or use lsof
sudo lsof -i :5433

# Kill the process or change port in docker-compose.test.yml
```

### WSL2 Integration Issues

If Docker Desktop was previously installed, you might need to:

1. **Uninstall Docker Desktop** (if installed)
2. **Remove old Docker configs**:
   ```bash
   rm -rf ~/.docker
   ```
3. **Follow installation steps above**

---

## Quick Setup Script

Save this as `setup-docker-wsl2.sh`:

```bash
#!/bin/bash
set -e

echo "Setting up Docker Engine on WSL2..."

# Update system
sudo apt update
sudo apt upgrade -y

# Install prerequisites
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker
sudo service docker start

# Add user to docker group
sudo usermod -aG docker $USER

# Fix credential helper
mkdir -p ~/.docker
cat > ~/.docker/config.json <<EOF
{
  "auths": {}
}
EOF

echo ""
echo "✅ Docker Engine installed!"
echo ""
echo "⚠️  IMPORTANT: Log out and log back in (or restart WSL) for group changes to take effect."
echo ""
echo "Then verify with:"
echo "  docker --version"
echo "  docker compose version"
echo "  docker ps"
```

Make it executable:
```bash
chmod +x setup-docker-wsl2.sh
./setup-docker-wsl2.sh
```

---

## After Installation

### 1. Restart WSL (or log out/in)

```bash
# In Windows PowerShell/CMD:
wsl --shutdown

# Then restart WSL
```

### 2. Verify Docker Works

```bash
docker --version
docker compose version
docker ps
```

### 3. Test Our Setup

```bash
cd /home/joshua-v-dev/projects/RevealUI

# Start test database
./scripts/setup-test-db.sh

# Or manually:
docker compose -f docker-compose.test.yml up -d
```

---

## Benefits of Docker Engine vs Docker Desktop

### Docker Engine (WSL2)
- ✅ Lighter weight
- ✅ Faster startup
- ✅ No Windows dependency
- ✅ Native Linux experience
- ✅ Better for CI/CD
- ✅ Free (no license concerns)

### Docker Desktop
- ❌ Heavy (requires Windows)
- ❌ Slower startup
- ❌ License restrictions for large companies
- ❌ More GUI overhead

---

## Next Steps

After Docker is set up:

1. **Test our automation**:
   ```bash
   ./scripts/setup-test-db.sh
   ```

2. **Run integration tests**:
   ```bash
   export POSTGRES_URL="postgresql://test:test@localhost:5433/test_revealui"
   pnpm --filter @revealui/memory test __tests__/integration/automated-validation.test.ts
   ```

3. **Run full validation**:
   ```bash
   ./scripts/run-automated-validation.sh
   ```

---

## References

- [Docker Engine Installation - Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Docker on WSL2](https://docs.docker.com/desktop/wsl/)
- [Docker Compose Installation](https://docs.docker.com/compose/install/)

---

**Status**: Ready for installation
