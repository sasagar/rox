#!/bin/bash
# Post-create script for Rox DevContainer
#
# This script runs automatically when the DevContainer is created.
# It sets up the development environment.

set -e

echo ""
echo "======================================"
echo "  Rox DevContainer Setup"
echo "======================================"
echo ""

# Change to workspace directory
cd /workspace

# ============================================
# Install mkcert and generate certificates
# ============================================
echo "[1/7] Setting up SSL certificates..."

if [ ! -f "docker/certs/localhost+2.pem" ]; then
    echo "  Installing mkcert..."

    # Install mkcert dependencies
    sudo apt-get update -qq
    sudo apt-get install -y -qq libnss3-tools > /dev/null 2>&1

    # Download and install mkcert
    MKCERT_VERSION="v1.4.4"
    curl -sL "https://github.com/FiloSottile/mkcert/releases/download/${MKCERT_VERSION}/mkcert-${MKCERT_VERSION}-linux-amd64" -o /tmp/mkcert
    sudo mv /tmp/mkcert /usr/local/bin/mkcert
    sudo chmod +x /usr/local/bin/mkcert

    # Install root CA
    mkcert -install

    # Generate certificates
    echo "  Generating certificates..."
    cd docker/certs
    mkcert localhost 127.0.0.1 ::1
    cd /workspace

    echo "  SSL certificates generated successfully!"
else
    echo "  SSL certificates already exist, skipping..."
fi

# ============================================
# Install Claude Code CLI
# ============================================
echo ""
echo "[2/7] Installing Claude Code CLI..."
npm install -g @anthropic-ai/claude-code

# Ensure Claude config directory exists in project root and symlinks are correct
mkdir -p /workspace/.claude
chown -R vscode:vscode /workspace/.claude 2>/dev/null || true
echo "  Claude Code installed successfully!"

# ============================================
# Install dependencies
# ============================================
echo ""
echo "[3/7] Installing dependencies..."
bun install

# ============================================
# Compile translations
# ============================================
echo ""
echo "[4/7] Compiling translations..."
bun run lingui:compile

# ============================================
# Run database migrations
# ============================================
echo ""
echo "[5/7] Running database migrations..."
# Wait for PostgreSQL to be ready
echo "  Waiting for PostgreSQL..."
until pg_isready -h postgres -U rox -d rox > /dev/null 2>&1; do
    sleep 1
done
echo "  PostgreSQL is ready!"

bun run db:migrate

# ============================================
# Create uploads directory
# ============================================
echo ""
echo "[6/7] Creating uploads directory..."
mkdir -p packages/backend/uploads

# ============================================
# Setup complete
# ============================================
echo ""
echo "[7/7] Setup complete!"
echo ""
echo "======================================"
echo "  Rox DevContainer Ready!"
echo "======================================"
echo ""
echo "Available commands:"
echo "  bun run dev           - Start development server"
echo "  bun run dev:backend   - Start backend only"
echo "  bun run dev:frontend  - Start frontend only"
echo "  bun test              - Run tests"
echo ""
echo "Database connections:"
echo "  PostgreSQL: postgresql://rox:rox_dev_password@postgres:5432/rox"
echo "  MariaDB:    mysql://rox:rox_dev_password@mariadb:3306/rox"
echo "  Dragonfly:  redis://dragonfly:6379"
echo ""
echo "HTTPS Access:"
echo "  https://localhost (after starting dev server)"
echo ""
echo "Claude Code:"
echo "  Run 'claude login' to authenticate with Anthropic API"
echo "  Or set ANTHROPIC_API_KEY in .devcontainer/.env"
echo ""
