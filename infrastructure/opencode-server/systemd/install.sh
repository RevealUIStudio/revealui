#!/bin/bash
# Install OpenCode Server as a Systemd Service

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║  OpenCode Server - Systemd Service Installation        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root (use sudo)${NC}"
    exit 1
fi

# Configuration
INSTALL_DIR="/opt/opencode-server"
SERVICE_NAME="opencode-server"
SERVICE_FILE="systemd/opencode-server.service"
USER_NAME="opencode"
GROUP_NAME="opencode"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker Compose not found, checking for docker compose (v2)...${NC}"
    if ! docker compose version &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        exit 1
    fi
fi

# Create user and group
echo -e "${BLUE}👤 Creating user and group...${NC}"
if ! id "$USER_NAME" &>/dev/null; then
    groupadd -r "$GROUP_NAME" 2>/dev/null || true
    useradd -r -g "$GROUP_NAME" -d "$INSTALL_DIR" -s /bin/false "$USER_NAME"
    echo -e "${GREEN}✅ User $USER_NAME created${NC}"
else
    echo -e "${YELLOW}⚠️  User $USER_NAME already exists${NC}"
fi

# Create installation directory
echo -e "${BLUE}📁 Creating installation directory...${NC}"
mkdir -p "$INSTALL_DIR"

# Get the source directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(dirname "$SCRIPT_DIR")"

# Copy files
echo -e "${BLUE}📂 Copying files to $INSTALL_DIR...${NC}"
cp -r "$SOURCE_DIR"/* "$INSTALL_DIR/"

# Set permissions
echo -e "${BLUE}🔒 Setting permissions...${NC}"
chown -R "$USER_NAME:$GROUP_NAME" "$INSTALL_DIR"
chmod +x "$INSTALL_DIR"/*.sh
chmod +x "$INSTALL_DIR"/docker-entrypoint.sh

# Install systemd service
echo -e "${BLUE}⚙️  Installing systemd service...${NC}"
cp "$INSTALL_DIR/$SERVICE_FILE" /etc/systemd/system/
systemctl daemon-reload

# Check if .env exists
if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found!${NC}"
    echo -e "${BLUE}📝 Creating from template...${NC}"
    cp "$INSTALL_DIR/.env.template" "$INSTALL_DIR/.env"
    chown "$USER_NAME:$GROUP_NAME" "$INSTALL_DIR/.env"
    echo -e "${YELLOW}⚠️  Please edit $INSTALL_DIR/.env with your API keys before starting the service${NC}"
    echo "   nano $INSTALL_DIR/.env"
fi

# Enable service
echo -e "${BLUE}🚀 Enabling service...${NC}"
systemctl enable "$SERVICE_NAME"

echo ""
echo -e "${GREEN}🎉 Installation complete!${NC}"
echo ""
echo "Service commands:"
echo "  ${BLUE}systemctl start $SERVICE_NAME${NC}    - Start the service"
echo "  ${BLUE}systemctl stop $SERVICE_NAME${NC}     - Stop the service"
echo "  ${BLUE}systemctl restart $SERVICE_NAME${NC}  - Restart the service"
echo "  ${BLUE}systemctl status $SERVICE_NAME${NC}   - Check service status"
echo "  ${BLUE}journalctl -u $SERVICE_NAME -f${NC}   - View logs"
echo ""
echo "Next steps:"
if [ ! -f "$INSTALL_DIR/.env" ] || ! grep -q "sk-" "$INSTALL_DIR/.env"; then
    echo "  1. Edit $INSTALL_DIR/.env with your API keys"
    echo "  2. Start the service: systemctl start $SERVICE_NAME"
else
    echo "  1. Start the service: systemctl start $SERVICE_NAME"
fi
echo ""
echo -e "${YELLOW}📝 Note: The service runs under user '$USER_NAME' for security${NC}"