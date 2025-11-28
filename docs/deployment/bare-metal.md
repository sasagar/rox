# Bare Metal Deployment Guide

This guide covers deploying Rox directly on a Linux server without Docker.

## Prerequisites

- Ubuntu 22.04+ or Debian 12+ (other distros work but commands may differ)
- At least 2GB RAM and 20GB storage
- Root or sudo access
- A domain name pointing to your server
- Ports 80 and 443 available

## Configuration Variables

> **IMPORTANT**: Set these variables ONCE at the beginning of your installation session.
> All subsequent commands will use these values automatically.

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

## Quick Start

```bash
# 1. Install dependencies
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 2. Clone and build
git clone https://github.com/your-org/rox.git
cd rox
bun install
bun run build

# 3. Configure (see detailed steps below)

# 4. Start
bun run start
```

## Detailed Setup

### 1. System Preparation

#### Update System

```bash
sudo apt update && sudo apt upgrade -y
```

#### Install Required Packages

```bash
sudo apt install -y curl git build-essential
```

### 2. Install Bun Runtime

```bash
# Install Bun for your current user
curl -fsSL https://bun.sh/install | bash

# Add to PATH (or restart shell)
source ~/.bashrc

# Verify installation
bun --version
```

> **Note**: If you're running the application as a dedicated user (e.g., `rox`), install Bun for that user as well:
> ```bash
> sudo -u rox bash -c 'curl -fsSL https://bun.sh/install | bash'
> ```

### 3. Install PostgreSQL

```bash
# Install PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER rox WITH PASSWORD '${ROX_DB_PASSWORD}';
CREATE DATABASE rox OWNER rox;
GRANT ALL PRIVILEGES ON DATABASE rox TO rox;
EOF

# Test connection
PGPASSWORD="${ROX_DB_PASSWORD}" psql -U rox -h localhost -d rox -c "SELECT 1;"
```

### 4. Install Dragonfly (Optional, for Queue)

Dragonfly provides Redis-compatible caching and job queue functionality.

```bash
# Download Dragonfly
curl -L https://github.com/dragonflydb/dragonfly/releases/latest/download/dragonfly-x86_64.tar.gz | tar xz

# Move to system location
sudo mv dragonfly /usr/local/bin/

# Create data directory
sudo mkdir -p /var/lib/dragonfly
sudo chown $USER:$USER /var/lib/dragonfly

# Create systemd service
sudo tee /etc/systemd/system/dragonfly.service > /dev/null <<EOF
[Unit]
Description=Dragonfly In-Memory Database
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=/usr/local/bin/dragonfly --dir /var/lib/dragonfly --maxmemory 256mb
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Start Dragonfly
sudo systemctl daemon-reload
sudo systemctl enable dragonfly
sudo systemctl start dragonfly

# Verify
redis-cli ping
```

**Note:** Rox works without Dragonfly, but ActivityPub delivery will be synchronous (slower).

### 5. Clone and Build Rox

```bash
# Clone repository
cd /opt
sudo git clone https://github.com/your-org/rox.git
sudo chown -R $USER:$USER rox
cd rox

# Install dependencies
bun install

# Build (if needed)
bun run build
```

### 6. Configure Environment

```bash
# Create environment file
cat > .env << EOF
# Server
NODE_ENV=production
PORT=3000
URL=https://${ROX_DOMAIN}

# Database
DB_TYPE=postgres
DATABASE_URL=postgresql://rox:${ROX_DB_PASSWORD}@localhost:5432/rox

# Cache/Queue (optional)
DRAGONFLY_URL=redis://localhost:6379

# Storage
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=/opt/rox/uploads

# Features
ENABLE_REGISTRATION=true
SESSION_EXPIRY_DAYS=30

# Logging
LOG_LEVEL=info
EOF

# Create uploads directory
mkdir -p /opt/rox/uploads
```

### 7. Run Database Migrations

```bash
cd /opt/rox

# Run migrations (uses environment variable)
DB_TYPE=postgres DATABASE_URL="postgresql://rox:${ROX_DB_PASSWORD}@localhost:5432/rox" \
  bun run --filter hono_rox db:migrate
```

### 8. Create Systemd Service

This creates a single service that manages both backend and frontend:

```bash
sudo tee /etc/systemd/system/rox.service > /dev/null <<EOF
[Unit]
Description=Rox ActivityPub Server (Backend + Frontend)
After=network.target postgresql.service dragonfly.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/rox
Environment=NODE_ENV=production
EnvironmentFile=/opt/rox/.env
ExecStart=/home/$USER/.bun/bin/bun run start
Restart=always
RestartSec=5

# Resource limits
MemoryMax=1.5G
CPUQuota=300%

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/opt/rox/uploads

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable rox
sudo systemctl start rox

# Check status
sudo systemctl status rox
```

The `bun run start` command runs the unified startup script that manages both:
- **Backend (API)**: `http://localhost:3000`
- **Frontend (Waku)**: `http://localhost:3001`

### 9. Configure Reverse Proxy

Choose one of the following options:

#### Option A: Caddy (Recommended - Automatic HTTPS)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Configure Caddy
sudo tee /etc/caddy/Caddyfile > /dev/null << EOF
${ROX_DOMAIN} {
    reverse_proxy localhost:3000

    header {
        # Security headers
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }

    # Enable compression
    encode gzip

    # Logging
    log {
        output file /var/log/caddy/rox.log
    }
}
EOF

# Restart Caddy
sudo systemctl restart caddy
```

#### Option B: Nginx with Let's Encrypt

```bash
# Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Create Nginx config
sudo tee /etc/nginx/sites-available/rox > /dev/null << EOF
server {
    listen 80;
    server_name ${ROX_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # ActivityPub requires these
        proxy_set_header Accept \$http_accept;
    }

    # Increase body size for file uploads
    client_max_body_size 10M;
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/rox /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d ${ROX_DOMAIN} --non-interactive --agree-tos -m ${ROX_ADMIN_EMAIL}
```

### 10. Configure Firewall

```bash
# UFW
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 11. Verify Deployment

```bash
# Check service status
sudo systemctl status rox

# Test health endpoint
curl -s https://${ROX_DOMAIN}/health | jq

# Test readiness
curl -s https://${ROX_DOMAIN}/health/ready | jq
```

## Architecture

```
                    ┌─────────────┐
        Internet    │ Caddy/Nginx │ :80/:443
            ↓       │   (HTTPS)   │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │     Rox     │ :3000
                    │  (Bun/Hono) │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────┴─────┐   ┌─────┴─────┐   ┌──────┴──────┐
    │ PostgreSQL│   │ Dragonfly │   │   Uploads   │
    │   :5432   │   │   :6379   │   │  /opt/rox/  │
    └───────────┘   └───────────┘   └─────────────┘
```

## Save Your Configuration

Save these values securely - you'll need them for maintenance:

```bash
echo "=== ROX INSTALLATION DETAILS ==="
echo "Domain: ${ROX_DOMAIN}"
echo "Database Password: ${ROX_DB_PASSWORD}"
echo "Admin Email: ${ROX_ADMIN_EMAIL}"
echo "================================"
```

## Common Operations

### Session Lost - Re-set Variables

If you closed your terminal and need to continue:

```bash
# Set your values again
export ROX_DOMAIN="rox.example.com"
export ROX_DB_PASSWORD="your-saved-password"
export ROX_ADMIN_EMAIL="admin@example.com"
```

### View Logs

```bash
# Rox application logs
sudo journalctl -u rox -f

# Last 100 lines
sudo journalctl -u rox -n 100

# Filter by time
sudo journalctl -u rox --since "1 hour ago"
```

### Restart Services

```bash
# Restart Rox
sudo systemctl restart rox

# Restart all services
sudo systemctl restart postgresql dragonfly rox caddy
```

### Update Rox

```bash
cd /opt/rox

# Stop service
sudo systemctl stop rox

# Pull updates
git pull origin main

# Install dependencies
bun install

# Run migrations (source .env for credentials)
source /opt/rox/.env
DB_TYPE=$DB_TYPE DATABASE_URL=$DATABASE_URL bun run --filter hono_rox db:migrate

# Start service
sudo systemctl start rox
```

### Database Backup

```bash
# Create backup (uses environment variable)
PGPASSWORD="${ROX_DB_PASSWORD}" pg_dump -U rox -h localhost rox > /backup/rox_$(date +%Y%m%d_%H%M%S).sql

# Automated daily backup (add to crontab)
# 0 2 * * * PGPASSWORD="your-saved-password" pg_dump -U rox -h localhost rox > /backup/rox_$(date +\%Y\%m\%d).sql
```

### Database Restore

```bash
# Stop Rox first
sudo systemctl stop rox

# Restore
PGPASSWORD="${ROX_DB_PASSWORD}" psql -U rox -h localhost rox < /backup/rox_20251126.sql

# Start Rox
sudo systemctl start rox
```

## Performance Tuning

### PostgreSQL

Edit `/etc/postgresql/16/main/postgresql.conf`:

```ini
# Memory (adjust based on available RAM)
shared_buffers = 256MB
effective_cache_size = 768MB
work_mem = 16MB

# Connections
max_connections = 100

# WAL
wal_buffers = 16MB
```

```bash
sudo systemctl restart postgresql
```

### System Limits

Edit `/etc/security/limits.conf`:

```
* soft nofile 65535
* hard nofile 65535
```

### Bun Settings

In `.env`:

```ini
# Increase max listeners for high traffic
UV_THREADPOOL_SIZE=16
```

## Monitoring

### Check Resource Usage

```bash
# CPU and Memory
htop

# Disk usage
df -h

# PostgreSQL connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
```

### Prometheus Metrics

Rox exposes metrics at `/metrics`:

```bash
curl -s https://${ROX_DOMAIN}/metrics
```

## Troubleshooting

### Rox Won't Start

```bash
# Check logs
sudo journalctl -u rox -n 50

# Check if port is in use
sudo lsof -i :3000

# Test manually
cd /opt/rox
bun run --cwd packages/backend src/index.ts
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
PGPASSWORD="${ROX_DB_PASSWORD}" psql -U rox -h localhost -d rox -c "SELECT 1;"

# Check pg_hba.conf if authentication fails
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

### SSL Certificate Issues

```bash
# Caddy - check logs
sudo journalctl -u caddy -n 50

# Nginx/Certbot - renew manually
sudo certbot renew --dry-run
```

### Permission Errors

```bash
# Fix uploads directory
sudo chown -R $USER:$USER /opt/rox/uploads
chmod 755 /opt/rox/uploads
```

## Security Checklist

- [ ] Use strong PostgreSQL password
- [ ] Disable registration after admin account created
- [ ] Configure firewall (UFW)
- [ ] Keep system updated (`apt update && apt upgrade`)
- [ ] Set up automated backups
- [ ] Use fail2ban for SSH protection
- [ ] Monitor logs for suspicious activity

## Comparison: Docker vs Bare Metal

| Aspect | Docker | Bare Metal |
|--------|--------|------------|
| Setup Complexity | Lower | Higher |
| Resource Overhead | ~100-200MB | None |
| Updates | Rebuild container | git pull + restart |
| Isolation | Full | Process level |
| Debugging | Through containers | Direct access |
| Portability | High | OS-specific |
| Performance | Slight overhead | Native |

Choose **Docker** if:
- You want simpler deployment
- You're familiar with containers
- You need easy rollback capability

Choose **Bare Metal** if:
- You want maximum performance
- You have limited RAM (<2GB)
- You prefer direct system access
- You're comfortable with Linux administration
