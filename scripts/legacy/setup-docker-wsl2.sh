#!/bin/bash
# Setup Docker Engine on WSL2 (without Docker Desktop)
set -e

echo "=========================================="
echo "Setting up Docker Engine on WSL2"
echo "=========================================="

# Check if Docker is already installed
if command -v docker &> /dev/null; then
    echo "Docker is already installed:"
    docker --version
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# Update system
echo ""
echo "Step 1: Updating system..."
sudo apt update
sudo apt upgrade -y

# Install prerequisites
echo ""
echo "Step 2: Installing prerequisites..."
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker GPG key
echo ""
echo "Step 3: Adding Docker GPG key..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo ""
echo "Step 4: Adding Docker repository..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
echo ""
echo "Step 5: Installing Docker Engine..."
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker
echo ""
echo "Step 6: Starting Docker service..."
sudo service docker start

# Add user to docker group
echo ""
echo "Step 7: Adding user to docker group..."
sudo usermod -aG docker $USER

# Fix credential helper
echo ""
echo "Step 8: Fixing Docker credential configuration..."
mkdir -p ~/.docker
cat > ~/.docker/config.json <<'CONFIG'
{
  "auths": {}
}
CONFIG

echo ""
echo "=========================================="
echo "✅ Docker Engine installed!"
echo "=========================================="
echo ""
echo "⚠️  IMPORTANT: You need to log out and log back in (or restart WSL)"
echo "   for group changes to take effect."
echo ""
echo "To restart WSL, run in Windows PowerShell:"
echo "  wsl --shutdown"
echo ""
echo "Then verify with:"
echo "  docker --version"
echo "  docker compose version"
echo "  docker ps"
echo ""
