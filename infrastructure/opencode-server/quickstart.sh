#!/bin/bash
# Quick Start Script for OpenCode Docker Server

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║     OpenCode Docker Server - Quick Start Setup        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose found${NC}"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 Creating .env from template...${NC}"
    cp .env.template .env
    
    echo -e "${YELLOW}⚠️  Please edit .env with your API keys:${NC}"
    echo "   - OPENAI_API_KEY or ANTHROPIC_API_KEY (required)"
    echo "   - PROJECT_PATH (path to your code)"
    echo ""
    echo -e "${BLUE}   nano .env${NC}"
    echo ""
    echo "Then run this script again."
    exit 0
else
    echo -e "${GREEN}✅ .env file found${NC}"
fi

# Check if API keys are set
if ! grep -q "sk-" .env && ! grep -q "sk-ant-" .env; then
    echo -e "${YELLOW}⚠️  No API keys detected in .env${NC}"
    echo "Please add at least one AI provider API key to .env"
    exit 1
fi

# Build the image
echo -e "${BLUE}🔨 Building OpenCode server...${NC}"
DOCKER_BUILDKIT=1 docker-compose build

# Test the container
echo -e "${BLUE}🧪 Testing container...${NC}"
if docker-compose run --rm opencode opencode --version; then
    echo -e "${GREEN}✅ OpenCode installed successfully${NC}"
else
    echo -e "${RED}❌ OpenCode installation failed${NC}"
    exit 1
fi

# Success
echo ""
echo -e "${GREEN}🎉 OpenCode Docker Server is ready!${NC}"
echo ""
echo "Quick Commands:"
echo "  ${BLUE}make run${NC}          - Start OpenCode interactively"
echo "  ${BLUE}make shell${NC}        - Open bash shell"
echo "  ${BLUE}make analyze${NC}      - Analyze your project"
echo "  ${BLUE}make help${NC}         - Show all commands"
echo ""
echo "Examples:"
echo "  ${BLUE}make run PROJECT_PATH=/home/user/my-project${NC}"
echo "  ${BLUE}docker-compose run --rm opencode opencode --help${NC}"
echo ""
echo -e "${YELLOW}Happy coding! 🤖${NC}"