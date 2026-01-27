#!/bin/bash
# Stripe CLI Installation Script for WSL2/Ubuntu/Debian
# This script installs the latest Stripe CLI on Linux systems

set -e

echo "🚀 Stripe CLI Installation Script"
echo "=================================="
echo ""

# Check if already installed
if command -v stripe &> /dev/null; then
    CURRENT_VERSION=$(stripe version 2>/dev/null | head -1 || echo "unknown")
    echo "✅ Stripe CLI is already installed: $CURRENT_VERSION"
    read -p "Do you want to reinstall/update? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
fi

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    ARCH_TYPE="amd64"
    TARBALL_ARCH="x86_64"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    ARCH_TYPE="arm64"
    TARBALL_ARCH="arm64"
else
    echo "❌ Unsupported architecture: $ARCH"
    exit 1
fi

echo "📦 Architecture detected: $ARCH_TYPE"
echo ""

# Get latest version from GitHub API
echo "🔍 Fetching latest Stripe CLI version..."
LATEST_VERSION=$(curl -s https://api.github.com/repos/stripe/stripe-cli/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | sed 's/^v//')

if [ -z "$LATEST_VERSION" ]; then
    echo "❌ Could not determine latest version. Please install manually."
    exit 1
fi

echo "✅ Latest version: $LATEST_VERSION"
echo ""

# Installation method selection
echo "Select installation method:"
echo "1) .deb package (recommended for Ubuntu/Debian)"
echo "2) Binary tarball (manual install)"
read -p "Enter choice [1]: " INSTALL_METHOD
INSTALL_METHOD=${INSTALL_METHOD:-1}

case $INSTALL_METHOD in
    1)
        # .deb package installation
        DEB_FILE="stripe_${LATEST_VERSION}_linux_${ARCH_TYPE}.deb"
        DOWNLOAD_URL="https://github.com/stripe/stripe-cli/releases/download/v${LATEST_VERSION}/${DEB_FILE}"
        
        echo "📥 Downloading $DEB_FILE..."
        cd /tmp
        curl -L -o "$DEB_FILE" "$DOWNLOAD_URL"
        
        echo "📦 Installing package..."
        sudo dpkg -i "$DEB_FILE" || {
            echo "⚠️  Fixing dependencies..."
            sudo apt-get install -f -y
        }
        
        # Cleanup
        rm -f "$DEB_FILE"
        ;;
    2)
        # Tarball installation
        TAR_FILE="stripe_${LATEST_VERSION}_linux_${TARBALL_ARCH}.tar.gz"
        DOWNLOAD_URL="https://github.com/stripe/stripe-cli/releases/download/v${LATEST_VERSION}/${TAR_FILE}"
        
        echo "📥 Downloading $TAR_FILE..."
        cd /tmp
        curl -L -o "$TAR_FILE" "$DOWNLOAD_URL"
        
        echo "📦 Extracting..."
        tar -xzf "$TAR_FILE"
        
        echo "📦 Installing to /usr/local/bin..."
        sudo mv stripe /usr/local/bin/
        sudo chmod +x /usr/local/bin/stripe
        
        # Cleanup
        rm -f "$TAR_FILE"
        ;;
    *)
        echo "❌ Invalid choice."
        exit 1
        ;;
esac

# Verify installation
echo ""
if command -v stripe &> /dev/null; then
    INSTALLED_VERSION=$(stripe version 2>/dev/null | head -1 || echo "unknown")
    echo "✅ Stripe CLI installed successfully!"
    echo "   Version: $INSTALLED_VERSION"
    echo ""
    echo "🔐 Next steps:"
    echo "   1. Run: stripe login"
    echo "   2. Start webhook forwarding: stripe listen --forward-to localhost:4000/api/webhooks/stripe"
    echo "   3. Copy the webhook secret (whsec_...) to your .env file"
    echo ""
    echo "📚 For more details, see: docs/guides/stripe-sandbox-setup.md"
else
    echo "❌ Installation may have failed. Please check the output above."
    exit 1
fi
