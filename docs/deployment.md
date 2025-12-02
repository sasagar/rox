# Production Deployment Guide

This guide covers deploying Rox to a production VPS environment with Nginx as a reverse proxy.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Application Installation](#application-installation)
4. [Systemd Service](#systemd-service)
5. [Nginx Configuration](#nginx-configuration)
6. [SSL/TLS Setup](#ssltls-setup)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Ubuntu 22.04+ or Debian 12+
- Domain name pointing to your server
- At least 2GB RAM (4GB recommended)
- PostgreSQL 14+
- Bun runtime

---

## Server Setup

### Install Dependencies

```bash
# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y nginx certbot python3-certbot-nginx postgresql

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

### Create Application User

```bash
# Create rox user
useradd -r -s /bin/bash -d /opt/rox rox
mkdir -p /opt/rox
chown rox:rox /opt/rox
```

---

## Application Installation

### Clone and Build

```bash
# Switch to rox user
su - rox

# Clone repository
git clone https://github.com/Love-rox/rox.git /opt/rox
cd /opt/rox

# Install dependencies
bun install

# Build frontend
cd packages/frontend && bun run build
```

### Environment Configuration

Create `/opt/rox/.env`:

```ini
# Database
DB_TYPE=postgres
DATABASE_URL=postgresql://rox:your_password@localhost:5432/rox

# Storage
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=/opt/rox/uploads

# Application
PORT=3000
NODE_ENV=production
URL=https://your-domain.com

# Features
ENABLE_REGISTRATION=true
SESSION_EXPIRY_DAYS=30
```

### Database Setup

```bash
# Create database
sudo -u postgres psql -c "CREATE USER rox WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "CREATE DATABASE rox OWNER rox;"

# Run migrations
cd /opt/rox/packages/backend
DB_TYPE=postgres DATABASE_URL="postgresql://rox:your_password@localhost:5432/rox" bun run db:migrate
```

---

## Systemd Service

Create `/etc/systemd/system/rox.service`:

```ini
[Unit]
Description=Rox ActivityPub Server (Backend + Frontend)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=rox
Group=rox
WorkingDirectory=/opt/rox
Environment=NODE_ENV=production
EnvironmentFile=/opt/rox/.env
ExecStart=/home/rox/.bun/bin/bun scripts/start-production.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Resource limits
MemoryMax=2G
CPUQuota=80%

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/rox/uploads /opt/rox/logs

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
systemctl daemon-reload
systemctl enable rox
systemctl start rox
systemctl status rox
```

---

## Nginx Configuration

### Basic Configuration

Create `/etc/nginx/sites-available/rox`:

```nginx
# Upstream definitions
upstream rox_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

upstream rox_frontend {
    server 127.0.0.1:3001;
    keepalive 32;
}

# Rate limiting zones
# IMPORTANT: These values are tuned for typical usage.
# Adjust based on your traffic patterns.
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;
limit_conn_zone $binary_remote_addr zone=sse_conn:10m;

server {
    server_name your-domain.com;

    # File upload size limit
    client_max_body_size 20M;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Logging
    access_log /var/log/nginx/rox.access.log;
    error_log /var/log/nginx/rox.error.log;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # ===========================================
    # Backend Routes
    # ===========================================

    # API endpoints (general)
    location /api/ {
        # Rate limit: 30 requests/second with burst of 50
        limit_req zone=api_limit burst=50 nodelay;

        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    # SSE endpoint (Server-Sent Events for notifications)
    # Requires special configuration for long-lived connections
    location /api/notifications/stream {
        # Connection limit: 20 concurrent SSE connections per IP
        # This prevents SSE reconnection storms from overwhelming the server
        limit_conn sse_conn 20;

        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        # SSE-specific settings
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;  # 24 hours
        chunked_transfer_encoding off;
    }

    # Auth endpoints (stricter rate limiting to prevent brute force)
    location /api/auth/ {
        # Rate limit: 5 requests/minute
        limit_req zone=auth_limit burst=5 nodelay;

        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    # ===========================================
    # ActivityPub Routes (Backend)
    # ===========================================

    location /.well-known/webfinger {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /.well-known/nodeinfo {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /nodeinfo/ {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /users/ {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /notes/ {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ===========================================
    # Health Check
    # ===========================================

    location /health {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # SSL configuration will be added by Certbot
    listen 80;
}
```

### Enable Site

```bash
ln -s /etc/nginx/sites-available/rox /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## SSL/TLS Setup

### Using Certbot

```bash
certbot --nginx -d your-domain.com
```

Certbot will automatically:
- Obtain SSL certificate
- Configure Nginx for HTTPS
- Set up auto-renewal

### Verify Renewal

```bash
certbot renew --dry-run
```

---

## Troubleshooting

### Rate Limiting Issues (503 Errors)

**Symptoms:**
- Browser console shows `503 (Service Unavailable)` errors
- Multiple API requests fail on page load
- SSE connections disconnect frequently

**Check Nginx error logs:**

```bash
grep -E "(limiting|limit_req|503)" /var/log/nginx/rox.error.log | tail -50
```

**Common error messages and solutions:**

1. **`limiting requests, excess: XX by zone "api_limit"`**

   The API rate limit is too restrictive. Increase the rate and burst values:

   ```nginx
   # Before (too restrictive)
   limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
   location /api/ {
       limit_req zone=api_limit burst=20 nodelay;
   }

   # After (recommended)
   limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
   location /api/ {
       limit_req zone=api_limit burst=50 nodelay;
   }
   ```

2. **`limiting connections by zone "sse_conn"`**

   SSE connection limit is too low. The frontend may open multiple SSE connections (e.g., for different tabs or reconnection attempts):

   ```nginx
   # Before (too restrictive)
   limit_conn sse_conn 5;

   # After (recommended)
   limit_conn sse_conn 20;
   ```

3. **`upstream prematurely closed connection`**

   Backend is closing SSE connections. This is normal behavior for the Rox SSE implementation which uses short-lived connections. Ensure the frontend handles reconnection gracefully.

**After making changes:**

```bash
nginx -t
systemctl reload nginx
```

### Application Not Starting

**Check service status:**

```bash
systemctl status rox
journalctl -u rox -n 100 --no-pager
```

**Common issues:**

1. **Database connection failed**
   - Verify PostgreSQL is running: `systemctl status postgresql`
   - Check connection string in `.env`
   - Ensure database user has permissions

2. **Port already in use**
   - Check what's using the port: `ss -tlnp | grep :3000`
   - Kill existing process or use different port

3. **Permission errors**
   - Ensure `/opt/rox/uploads` is writable by rox user
   - Check file ownership: `ls -la /opt/rox`

### Memory Issues

**Monitor memory usage:**

```bash
systemctl status rox
# Check "Memory:" line

# Or use:
ps aux | grep bun
free -h
```

**If memory is high:**

1. Adjust systemd memory limit in service file
2. Increase server RAM
3. Check for memory leaks in application logs

### SSL Certificate Issues

**Renew certificate manually:**

```bash
certbot renew --force-renewal
systemctl reload nginx
```

**Check certificate expiry:**

```bash
certbot certificates
```

---

## Maintenance

### Updating the Application

```bash
# Switch to rox user
su - rox
cd /opt/rox

# Pull latest changes
git pull origin main

# Install dependencies
bun install

# Build frontend
cd packages/frontend && bun run build

# Run migrations (if any)
cd ../backend
bun run db:migrate

# Restart service
exit  # Back to root
systemctl restart rox
```

### Backup Database

```bash
# Create backup
pg_dump -U rox rox > /backup/rox_$(date +%Y%m%d).sql

# Restore from backup
psql -U rox rox < /backup/rox_20231201.sql
```

### Log Rotation

Nginx logs are automatically rotated by logrotate. For application logs, create `/etc/logrotate.d/rox`:

```
/var/log/rox/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 rox rox
    sharedscripts
    postrotate
        systemctl reload rox > /dev/null 2>&1 || true
    endscript
}
```

---

**Last Updated**: 2025-12-03
**Maintainer**: Development Team
