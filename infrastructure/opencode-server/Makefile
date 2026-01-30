# OpenCode Docker Server - Makefile
# Convenience commands for managing the OpenCode server

.PHONY: help build run shell test clean logs

# Default target
help:
	@echo "OpenCode Docker Server Commands:"
	@echo ""
	@echo "  make build          - Build the Docker image"
	@echo "  make run            - Run OpenCode interactively"
	@echo "  make shell          - Open bash shell in container"
	@echo "  make analyze        - Run deep analysis on project"
	@echo "  make fix            - Run auto-fix on project"
	@echo "  make test           - Run tests in container"
	@echo "  make logs           - View container logs"
	@echo "  make clean          - Remove containers and volumes"
	@echo "  make update         - Update OpenCode to latest version"
	@echo ""
	@echo "Environment:"
	@echo "  PROJECT_PATH        - Path to your code (default: ./workspace)"
	@echo ""
	@echo "Examples:"
	@echo "  make run PROJECT_PATH=/home/user/my-project"
	@echo "  make analyze PROJECT_PATH=/home/user/RevealUI"

# Build the Docker image
build:
	@echo "🔨 Building OpenCode server..."
	DOCKER_BUILDKIT=1 docker-compose build

# Run OpenCode interactively
run:
	@echo "🚀 Starting OpenCode..."
	docker-compose run --rm opencode

# Open shell in container
shell:
	@echo "🐚 Opening shell..."
	docker-compose run --rm opencode shell

# Analyze project
analyze:
	@echo "🔍 Analyzing project..."
	docker-compose run --rm opencode opencode analyze /workspace

# Auto-fix project
fix:
	@echo "🔧 Running auto-fix..."
	docker-compose run --rm opencode opencode fix /workspace

# Run tests
test:
	@echo "🧪 Running tests..."
	docker-compose run --rm opencode opencode test /workspace

# View logs
logs:
	@echo "📜 Viewing logs..."
	docker-compose logs -f opencode

# Clean up
clean:
	@echo "🧹 Cleaning up..."
	docker-compose down -v
	docker rmi infrastructure-opencode-server 2>/dev/null || true
	@echo "✅ Cleanup complete"

# Update OpenCode
update:
	@echo "⬆️  Updating OpenCode..."
	docker-compose down
	docker-compose build --no-cache
	@echo "✅ Update complete"

# Setup (first time)
setup:
	@echo "⚙️  Setting up OpenCode server..."
	@if [ ! -f .env ]; then \
		echo "📝 Creating .env from template..."; \
		cp .env.template .env; \
		echo "⚠️  Please edit .env with your API keys"; \
	else \
		echo "✅ .env already exists"; \
	fi
	@make build
	@echo ""
	@echo "🎉 Setup complete! Run 'make run' to start OpenCode"

# Check status
status:
	@echo "📊 Container Status:"
	@docker-compose ps
	@echo ""
	@echo "🖼️  Images:"
	@docker images | grep opencode || echo "No OpenCode images found"
	@echo ""
	@echo "📦 Volumes:"
	@docker volume ls | grep opencode || echo "No OpenCode volumes found"