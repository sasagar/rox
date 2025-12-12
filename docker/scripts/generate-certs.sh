#!/bin/bash
# Generate SSL certificates for local development using mkcert
#
# Usage: ./docker/scripts/generate-certs.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$(dirname "$SCRIPT_DIR")/certs"

echo "=== Rox SSL Certificate Generator ==="
echo ""

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo "Error: mkcert is not installed."
    echo ""
    echo "Please install mkcert first:"
    echo ""
    echo "  macOS:   brew install mkcert"
    echo "  Linux:   https://github.com/FiloSottile/mkcert#linux"
    echo "  Windows: choco install mkcert"
    echo ""
    exit 1
fi

# Check if certificates already exist
if [ -f "$CERTS_DIR/localhost+2.pem" ] && [ -f "$CERTS_DIR/localhost+2-key.pem" ]; then
    echo "Certificates already exist in $CERTS_DIR"
    echo ""
    read -p "Do you want to regenerate them? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing certificates."
        exit 0
    fi
fi

# Install root CA if not already installed
echo "Installing mkcert root CA (may require sudo)..."
mkcert -install
echo ""

# Generate certificates
echo "Generating certificates for localhost..."
cd "$CERTS_DIR"
mkcert localhost 127.0.0.1 ::1
echo ""

# Verify files were created
if [ -f "$CERTS_DIR/localhost+2.pem" ] && [ -f "$CERTS_DIR/localhost+2-key.pem" ]; then
    echo "=== Success! ==="
    echo ""
    echo "Certificates generated in: $CERTS_DIR"
    echo "  - localhost+2.pem (certificate)"
    echo "  - localhost+2-key.pem (private key)"
    echo ""
    echo "You can now use HTTPS in your development environment."
else
    echo "Error: Certificate generation failed."
    exit 1
fi
