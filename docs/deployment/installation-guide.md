# Rox Installation Guide

Complete step-by-step guide for deploying Rox on a VPS with Nginx.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Configuration Variables](#configuration-variables)
4. [Server Preparation](#server-preparation)
5. [Database Setup](#database-setup)
6. [Dragonfly Setup](#dragonfly-setup)
7. [Application Installation](#application-installation)
8. [Nginx Configuration](#nginx-configuration)
9. [SSL Certificate](#ssl-certificate)
10. [Service Management](#service-management)
11. [Initial Setup](#initial-setup)
12. [Verification](#verification)
13. [Post-Installation](#post-installation)

---

## Overview

### Architecture

Rox consists of two main components served from a single domain:

```
                    ┌─────────────────────────────────────┐
    Internet        │              Nginx                  │
        │           │         (rox.example.com)           │
        ▼           │                                     │
    HTTPS :443 ─────┼──► SSL Termination                  │
                    │            │                        │
                    │    ┌───────┴───────┐                │
                    │    │               │                │
                    │    ▼               ▼                │
                    │  /api/*         /* (other)          │
                    │  /.well-known/*                     │
                    │  /users/*                           │
                    │  /notes/*                           │
                    │  /health                            │
                    │                                     │
                    └────┬───────────────┬────────────────┘
                         │               │
                         ▼               ▼
                 ┌───────────────┐ ┌───────────────┐
                 │   Backend     │ │   Frontend    │
                 │  (Hono API)   │ │    (Waku)     │
                 │  port 3000    │ │  port 3001    │
                 └───────┬───────┘ └───────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
   ┌────────────┐ ┌────────────┐ ┌────────────┐
   │ PostgreSQL │ │ Dragonfly  │ │  Uploads   │
   │ port 5432  │ │ port 6379  │ │  (local)   │
   └────────────┘ └────────────┘ └────────────┘
```

### Component Overview

| Component | Technology | Port | Purpose |
|-----------|------------|------|---------|
| Frontend | Waku (React) | 3001 | User interface |
| Backend | Hono (Bun) | 3000 | API & ActivityPub |
| Database | PostgreSQL | 5432 | Data storage |
| Cache/Queue | Dragonfly | 6379 | Caching & job queue |
| Web Server | Nginx | 80/443 | Reverse proxy, SSL |

---

## Prerequisites

### Hardware Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4 GB |
| Storage | 20 GB SSD | 40 GB SSD |

### Software Requirements

- Ubuntu 22.04 LTS or Debian 12+ (this guide assumes Ubuntu)
- Domain name with DNS configured
- Root or sudo access

### DNS Configuration

Before starting, configure DNS for your domain:

| Type | Name | Value |
|------|------|-------|
| A | rox.example.com | YOUR_SERVER_IP |
| AAAA | rox.example.com | YOUR_SERVER_IPV6 (optional) |

---

## Configuration Variables

> **IMPORTANT**: Set these variables ONCE at the beginning of your installation session.
> All subsequent commands will use these values automatically.

Open a terminal and set the following environment variables:

```bash
# ============================================
# SET THESE VALUES FOR YOUR INSTALLATION
# ============================================

# Your domain name (without https://)
export ROX_DOMAIN="rox.example.com"

# Generate a secure database password (or set your own)
export ROX_DB_PASSWORD=$(openssl rand -base64 32)

# Your email address (for SSL certificate notifications)
export ROX_ADMIN_EMAIL="admin@example.com"

# ============================================
# VERIFY YOUR SETTINGS
# ============================================
echo "Domain: $ROX_DOMAIN"
echo "Database Password: $ROX_DB_PASSWORD"
echo "Admin Email: $ROX_ADMIN_EMAIL"
```

> **Save the database password!** You will need it if you lose your terminal session.
> Run `echo $ROX_DB_PASSWORD` to display it.

These variables will be used throughout the installation process. If you close your terminal,
you'll need to set them again before continuing.

---

## Server Preparation

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Required Packages

```bash
sudo apt install -y \
    curl \
    git \
    nginx \
    certbot \
    python3-certbot-nginx \
    postgresql \
    postgresql-contrib \
    unzip
```

### 3. Install Bun Runtime

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Verify installation
bun --version
```

### 4. Configure Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Verify
sudo ufw status
```

### 5. Create Application User

```bash
# Create rox user with home directory at /opt/rox
sudo useradd -r -m -d /opt/rox -s /bin/bash rox

# Install Bun for the rox user
sudo -u rox bash -c 'curl -fsSL https://bun.sh/install | bash'

# Verify bun installation
sudo -u rox /opt/rox/.bun/bin/bun --version
```

> **Note**: Bun is installed to `/opt/rox/.bun/bin/bun` because the rox user's home directory is `/opt/rox`.

### 6. Install Node.js (Required for Frontend)

The Waku frontend framework requires Node.js. We use Volta for Node.js version management:

```bash
# Install Volta for the rox user
sudo -u rox bash -c 'curl https://get.volta.sh | bash'

# Install Node.js LTS
sudo -u rox /opt/rox/.volta/bin/volta install node@lts

# Verify node installation
sudo -u rox /opt/rox/.volta/bin/node --version
```

> **Note**: Node.js is installed to `/opt/rox/.volta/bin/node`.

---

## Database Setup

### 1. Configure PostgreSQL

```bash
# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER rox WITH PASSWORD '${ROX_DB_PASSWORD}';
CREATE DATABASE rox OWNER rox;
GRANT ALL PRIVILEGES ON DATABASE rox TO rox;
\q
EOF
```

### 2. Verify Database Connection

```bash
PGPASSWORD="${ROX_DB_PASSWORD}" psql -U rox -h localhost -d rox -c "SELECT 1;"
```

Expected output: A table showing `1`.

---

## Dragonfly Setup

Dragonfly is a Redis-compatible in-memory data store used for caching and job queues.
It significantly improves performance for ActivityPub delivery and API response times.

> **Note**: Dragonfly is optional but highly recommended for production. Without it,
> Rox will fall back to synchronous delivery and no caching.

### 1. Install Dragonfly

```bash
# Add Dragonfly repository
curl -fsSL https://www.dragonflydb.io/dragonfly-apt.gpg | sudo gpg --dearmor -o /usr/share/keyrings/dragonfly-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/dragonfly-archive-keyring.gpg] https://apt.dragonflydb.io $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/dragonfly.list

# Install
sudo apt update
sudo apt install -y dragonfly
```

### 2. Configure Dragonfly

```bash
sudo tee /etc/dragonfly/dragonfly.conf << 'EOF'
# Bind to localhost only
bind 127.0.0.1

# Port
port 6379

# Memory limit (adjust based on available RAM)
maxmemory 256mb

# Eviction policy
maxmemory-policy allkeys-lru

# Persistence (optional, for queue durability)
dir /var/lib/dragonfly
dbfilename dump.rdb
EOF
```

### 3. Start Dragonfly

```bash
sudo systemctl enable dragonfly
sudo systemctl start dragonfly

# Verify
sudo systemctl status dragonfly
```

### 4. Test Connection

```bash
# Install redis-cli for testing
sudo apt install -y redis-tools

# Test connection
redis-cli ping
# Expected: PONG
```

### Alternative: Docker Installation

If you prefer Docker:

```bash
docker run -d \
  --name dragonfly \
  --restart unless-stopped \
  -p 127.0.0.1:6379:6379 \
  -v dragonfly-data:/data \
  docker.dragonflydb.io/dragonflydb/dragonfly \
  --maxmemory 256mb
```

---

## Application Installation

### 1. Clone Repository

```bash
sudo -u rox bash << 'EOF'
cd /opt/rox
git clone https://github.com/your-org/rox.git app
cd app
EOF
```

### 2. Install Dependencies

```bash
sudo -u rox bash << 'EOF'
cd /opt/rox/app
bun install
EOF
```

### 3. Configure Environment

Create the environment file:

```bash
sudo -u rox tee /opt/rox/app/.env << EOF
# Server Configuration
NODE_ENV=production
PORT=3000
URL=https://${ROX_DOMAIN}

# Database
DB_TYPE=postgres
DATABASE_URL=postgresql://rox:${ROX_DB_PASSWORD}@localhost:5432/rox

# Cache & Queue (Dragonfly)
DRAGONFLY_URL=redis://localhost:6379
USE_QUEUE=true

# Storage
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=/opt/rox/uploads

# Authentication
ENABLE_REGISTRATION=true
SESSION_EXPIRY_DAYS=30

# Logging
LOG_LEVEL=info
EOF
```

> **Note**: If Dragonfly is not installed, edit the `.env` file to remove `DRAGONFLY_URL` and set `USE_QUEUE=false`.

### 4. Create Upload Directory

```bash
sudo mkdir -p /opt/rox/uploads
sudo chown rox:rox /opt/rox/uploads
```

### 5. Run Database Migrations

```bash
sudo -u rox bash << EOF
cd /opt/rox/app
DB_TYPE=postgres DATABASE_URL="postgresql://rox:${ROX_DB_PASSWORD}@localhost:5432/rox" \
  bun run --filter hono_rox db:migrate
EOF
```

### 6. Build Application

```bash
sudo -u rox bash << 'EOF'
cd /opt/rox/app

# Build backend
cd packages/backend
bun run build

# Build frontend
cd ../frontend
bun run build
EOF
```

---

## Nginx Configuration

### 1. Create Nginx Configuration

```bash
sudo tee /etc/nginx/sites-available/rox << EOF
# Upstream definitions
upstream rox_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

upstream rox_frontend {
    server 127.0.0.1:3001;
    keepalive 32;
}

# Rate limiting
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=auth_limit:10m rate=5r/m;
limit_conn_zone \$binary_remote_addr zone=sse_conn:10m;

server {
    listen 80;
    listen [::]:80;
    server_name ${ROX_DOMAIN};

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${ROX_DOMAIN};

    # SSL (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/${ROX_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${ROX_DOMAIN}/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Logging
    access_log /var/log/nginx/rox.access.log;
    error_log /var/log/nginx/rox.error.log;

    # Max upload size
    client_max_body_size 20M;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # ===========================================
    # Backend Routes
    # ===========================================

    # API endpoints
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
    }

    # SSE endpoint (special config for long-lived connections)
    location /api/notifications/stream {
        limit_conn sse_conn 5;

        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";

        # SSE-specific settings
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        chunked_transfer_encoding off;
    }

    # Auth endpoints (stricter rate limiting)
    location /api/auth/ {
        limit_req zone=auth_limit burst=5 nodelay;

        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
    }

    # ===========================================
    # ActivityPub Routes (Backend)
    # ===========================================

    location /.well-known/webfinger {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /.well-known/nodeinfo {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /nodeinfo/ {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /users/ {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /notes/ {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # ===========================================
    # Health Check
    # ===========================================

    location /health {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # ===========================================
    # Static Uploads
    # ===========================================

    location /uploads/ {
        alias /opt/rox/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # ===========================================
    # Frontend (Default)
    # ===========================================

    location / {
        proxy_pass http://rox_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
```

### 2. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/rox /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

### 3. Test Configuration

```bash
sudo nginx -t
```

---

## SSL Certificate

### 1. Create Certbot Directory

```bash
sudo mkdir -p /var/www/certbot
```

### 2. Temporarily Modify Nginx for HTTP-only

Before obtaining the SSL certificate, we need to temporarily remove the HTTPS server block:

```bash
# Create a temporary HTTP-only config
sudo tee /etc/nginx/sites-available/rox-temp << EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${ROX_DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'SSL setup in progress';
        add_header Content-Type text/plain;
    }
}
EOF

# Use temporary config
sudo ln -sf /etc/nginx/sites-available/rox-temp /etc/nginx/sites-enabled/rox
sudo nginx -t && sudo systemctl reload nginx
```

### 3. Obtain Certificate

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d ${ROX_DOMAIN} --email ${ROX_ADMIN_EMAIL} --agree-tos --non-interactive
```

### 4. Restore Full Configuration

```bash
# Restore full config with SSL
sudo ln -sf /etc/nginx/sites-available/rox /etc/nginx/sites-enabled/rox
sudo rm /etc/nginx/sites-available/rox-temp
sudo nginx -t && sudo systemctl reload nginx
```

### 5. Verify Auto-Renewal

```bash
sudo certbot renew --dry-run
```

---

## Service Management

### 1. Create Systemd Service

This creates a single service that manages both backend and frontend:

```bash
sudo tee /etc/systemd/system/rox.service << 'EOF'
[Unit]
Description=Rox ActivityPub Server (Backend + Frontend)
After=network.target postgresql.service dragonfly.service
Wants=dragonfly.service

[Service]
Type=simple
User=rox
Group=rox
WorkingDirectory=/opt/rox/app
ExecStart=/opt/rox/.bun/bin/bun scripts/start-production.ts
Restart=always
RestartSec=5
EnvironmentFile=/opt/rox/app/.env

# PATH for Volta (Node.js) and Bun
Environment=PATH=/opt/rox/.volta/bin:/opt/rox/.bun/bin:/usr/local/bin:/usr/bin:/bin

# Resource limits
MemoryMax=1.5G
CPUQuota=300%

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=false
ReadWritePaths=/opt/rox/uploads /opt/rox/.volta /opt/rox/.bun

[Install]
WantedBy=multi-user.target
EOF
```

> **Note**: If Dragonfly is not installed, remove `dragonfly.service` from `After=` and `Wants=`.

### 2. Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable rox
sudo systemctl start rox
sudo systemctl reload nginx
```

### 3. Check Status

```bash
sudo systemctl status rox

# View logs
sudo journalctl -u rox -f
```

---

## Initial Setup

### 1. Verify Services

```bash
# Check health endpoint
curl -s https://${ROX_DOMAIN}/health | jq

# Check SSE health
curl -s https://${ROX_DOMAIN}/health/sse | jq
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-28T...",
  "version": "0.1.0"
}
```

### 2. Register First User (Admin)

```bash
curl -X POST https://${ROX_DOMAIN}/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "'"${ROX_ADMIN_EMAIL}"'",
    "password": "your-admin-password"
  }'
```

> **Note**: Replace `your-admin-password` with a strong password for your admin account.

### 3. Disable Registration

After creating your admin account:

```bash
sudo -u rox sed -i 's/ENABLE_REGISTRATION=true/ENABLE_REGISTRATION=false/' /opt/rox/app/.env
sudo systemctl restart rox-backend
```

---

## Verification

### 1. Check All Services

```bash
# Services
sudo systemctl status rox-backend rox-frontend nginx postgresql dragonfly

# Ports
sudo ss -tlnp | grep -E ':(80|443|3000|3001|5432|6379)'

# Logs
sudo journalctl -u rox-backend -f
sudo journalctl -u rox-frontend -f

# Verify Dragonfly is working
redis-cli ping
```

### 2. Test ActivityPub

```bash
# WebFinger
curl -s "https://${ROX_DOMAIN}/.well-known/webfinger?resource=acct:admin@${ROX_DOMAIN}" | jq

# NodeInfo
curl -s "https://${ROX_DOMAIN}/.well-known/nodeinfo" | jq
```

### 3. Access Web Interface

Open `https://YOUR_DOMAIN` in your browser and log in with the admin account.

---

## Post-Installation

### Security Checklist

- [ ] Registration disabled after admin account created
- [ ] Firewall configured (only 80, 443, 22 open)
- [ ] Strong database password set
- [ ] SSL certificate active and auto-renewing
- [ ] Server updates enabled (`sudo apt install unattended-upgrades`)

### Save Your Configuration

Save these values securely - you'll need them for maintenance:

```bash
echo "=== ROX INSTALLATION DETAILS ==="
echo "Domain: ${ROX_DOMAIN}"
echo "Database Password: ${ROX_DB_PASSWORD}"
echo "Admin Email: ${ROX_ADMIN_EMAIL}"
echo "================================"
```

### Recommended: Automatic Backups

```bash
# Create backup script
sudo tee /opt/rox/backup.sh << EOF
#!/bin/bash
BACKUP_DIR="/opt/rox/backups"
DATE=\$(date +%Y%m%d_%H%M%S)
mkdir -p \$BACKUP_DIR

# Database backup
PGPASSWORD="${ROX_DB_PASSWORD}" pg_dump -U rox -h localhost rox | gzip > \$BACKUP_DIR/db_\$DATE.sql.gz

# Uploads backup
tar -czf \$BACKUP_DIR/uploads_\$DATE.tar.gz /opt/rox/uploads

# Keep only last 7 days
find \$BACKUP_DIR -mtime +7 -delete
EOF

sudo chmod +x /opt/rox/backup.sh

# Add to cron (daily at 3 AM)
echo "0 3 * * * /opt/rox/backup.sh" | sudo crontab -
```

### Updating Rox

```bash
cd /opt/rox/app
sudo -u rox git pull
sudo -u rox bun install

# Run migrations (uses .env file for credentials)
sudo -u rox bash -c 'source /opt/rox/app/.env && \
  DB_TYPE=$DB_TYPE DATABASE_URL=$DATABASE_URL bun run --filter hono_rox db:migrate'

# Build
cd packages/backend && sudo -u rox bun run build
cd ../frontend && sudo -u rox bun run build
sudo systemctl restart rox-backend rox-frontend
```

### Monitoring Commands

```bash
# View logs
sudo journalctl -u rox-backend -f
sudo journalctl -u rox-frontend -f
sudo tail -f /var/log/nginx/rox.access.log

# Resource usage
htop
df -h

# SSE connections
curl -s https://${ROX_DOMAIN}/health/sse | jq '.metrics'
```

---

## Troubleshooting

### Session Lost - Re-set Variables

If you closed your terminal and need to continue:

```bash
# Set your values again
export ROX_DOMAIN="rox.example.com"
export ROX_DB_PASSWORD="your-saved-password"
export ROX_ADMIN_EMAIL="admin@example.com"
```

### Services Won't Start

```bash
# Check logs
sudo journalctl -u rox-backend -n 50 --no-pager
sudo journalctl -u rox-frontend -n 50 --no-pager

# Verify environment
sudo -u rox cat /opt/rox/app/.env

# Test database connection
PGPASSWORD="${ROX_DB_PASSWORD}" psql -U rox -h localhost -d rox -c "SELECT 1;"
```

### 502 Bad Gateway

```bash
# Check if backend is running
curl http://localhost:3000/health

# Check nginx config
sudo nginx -t
sudo tail -f /var/log/nginx/rox.error.log
```

### SSL Issues

```bash
# Check certificate
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal
```

### Database Connection Failed

```bash
# Verify PostgreSQL is running
sudo systemctl status postgresql

# Check password (ensure it matches .env)
grep DATABASE_URL /opt/rox/app/.env

# Test connection manually
PGPASSWORD="${ROX_DB_PASSWORD}" psql -U rox -h localhost -d rox -c "SELECT 1;"
```

---

## Support

- [GitHub Issues](https://github.com/your-org/rox/issues)
- [Documentation](./README.md)
- [Troubleshooting Guide](./troubleshooting.md)
