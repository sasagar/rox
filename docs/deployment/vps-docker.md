# VPS Docker Deployment Guide

This guide covers deploying Rox on a VPS (Virtual Private Server) using Docker Compose with Nginx as the reverse proxy.

## Architecture

```
                    ┌─────────────┐
        Internet    │   Nginx     │ :80
            ↓       │ (proxy)     │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────┴─────┐   ┌─────┴─────┐          │
    │  Backend  │   │ Frontend  │          │
    │  (Hono)   │   │  (Waku)   │          │
    │   :3000   │   │   :3001   │          │
    └─────┬─────┘   └───────────┘          │
          │                                 │
    ┌─────┴──────────────┬─────────────────┐
    │                    │                 │
┌───┴───────┐   ┌───────┴─────┐   ┌───────┴──────┐
│ PostgreSQL│   │ Dragonfly   │   │   Uploads    │
│   :5432   │   │   :6379     │   │   Volume     │
└───────────┘   └─────────────┘   └──────────────┘
```

## Services

| Service | Purpose | Port |
|---------|---------|------|
| rox-backend | Hono API server | 3000 |
| rox-frontend | Waku SSR server | 3001 |
| nginx | Reverse proxy with content negotiation | 80 |
| postgres | PostgreSQL database | 5432 |
| dragonfly | Redis-compatible cache/queue | 6379 |

## Prerequisites

- VPS with at least 2GB RAM and 20GB storage
- Docker Engine 24.0+ and Docker Compose v2
- A domain name pointing to your server's IP
- Ports 80 and 443 available

## SSL Termination Options

This Docker Compose setup exposes port 80 only. For HTTPS, choose one of:

1. **Cloudflare Proxy** (recommended) - Free SSL, DDoS protection
2. **Traefik** - Add Traefik container with Let's Encrypt
3. **External Nginx** - Install nginx on host with certbot

For a standalone HTTPS configuration, see [nginx.conf.example](./nginx.conf.example).

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

# Your email address (for notifications)
export ROX_ADMIN_EMAIL="admin@example.com"

# ============================================
# VERIFY YOUR SETTINGS
# ============================================
echo "Domain: $ROX_DOMAIN"
echo "Database Password: $ROX_DB_PASSWORD"
echo "Admin Email: $ROX_ADMIN_EMAIL"
```

> **Save the database password!** You will need it if you lose your terminal session.

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/rox.git
cd rox

# 2. Configure environment (using variables)
cat > docker/.env.production << EOF
ROX_DOMAIN=${ROX_DOMAIN}
ROX_URL=https://${ROX_DOMAIN}
POSTGRES_PASSWORD=${ROX_DB_PASSWORD}
ENABLE_REGISTRATION=true
EOF

# 3. Deploy
docker compose -f docker/compose.yml up -d

# 4. Verify
docker compose -f docker/compose.yml ps
curl http://localhost/health
```

## Detailed Setup

### 1. Server Preparation

#### Install Docker (Ubuntu/Debian)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

#### Configure Firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. DNS Configuration

Create an A record pointing your domain to your server's IP address:

| Type | Name | Value |
|------|------|-------|
| A | rox.example.com | YOUR_SERVER_IP |

Wait for DNS propagation (can take up to 48 hours, usually 5-15 minutes).

### 3. Environment Configuration

```bash
cd /path/to/rox

# Create environment file using shell variables
cat > docker/.env.production << EOF
# Required Settings
ROX_DOMAIN=${ROX_DOMAIN}
ROX_URL=https://${ROX_DOMAIN}
POSTGRES_PASSWORD=${ROX_DB_PASSWORD}

# Enable registration for initial setup
ENABLE_REGISTRATION=true
EOF

# Verify the file was created correctly
cat docker/.env.production
```

> **Note**: The password was automatically generated when you set `ROX_DB_PASSWORD` earlier.

### 4. Deploy

```bash
# Start all services
docker compose -f docker/compose.yml up -d

# Watch logs during initial startup
docker compose -f docker/compose.yml logs -f

# Check service status
docker compose -f docker/compose.yml ps
```

### 5. Verify Deployment

```bash
# Health check (local)
curl -s http://localhost/health | jq

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2025-11-26T12:00:00.000Z",
#   "version": "1.0.0"
# }

# Detailed health check
curl -s http://localhost/health/ready | jq

# Expected response:
# {
#   "status": "ok",
#   "checks": {
#     "database": "ok",
#     "cache": "ok"
#   }
# }
```

### 6. Create First User

Register your first (admin) user:

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

After creating your admin account, disable registration:

```bash
# Edit .env.production to disable registration
sed -i 's/ENABLE_REGISTRATION=true/ENABLE_REGISTRATION=false/' docker/.env.production

# Restart to apply
docker compose -f docker/compose.yml restart rox-backend
```

## Nginx Configuration

The Docker Compose setup includes Nginx with:

- **Trailing slash redirect**: `/timeline/` → `/timeline`
- **Content negotiation**: `/notes/` routes to backend for ActivityPub requests, frontend for browsers
- **SSE support**: Long timeout for `/api/notifications/stream`
- **WebSocket support**: Upgrade headers for `/ws/`
- **Rate limiting**: API endpoints, auth endpoints, and inbox

Configuration files:
- `docker/nginx/nginx.conf` - Main Nginx configuration
- `docker/nginx/conf.d/default.conf` - Site-specific configuration

## Resource Requirements

| Service | CPU | Memory | Storage |
|---------|-----|--------|---------|
| rox-backend | 0.5-2 cores | 256MB-1GB | - |
| rox-frontend | 0.25-1 core | 128MB-512MB | - |
| PostgreSQL | 0.25-1 core | 128MB-512MB | 10GB+ |
| Dragonfly | 0.25-1 core | 64MB-512MB | 1GB |
| Nginx | 0.5 core | 128MB | 100MB |
| **Total** | **2-4 cores** | **1.5-3GB** | **12GB+** |

Recommended minimum VPS: 2 vCPU, 2GB RAM, 40GB SSD

## Common Operations

### View Logs

```bash
# All services
docker compose -f docker/compose.yml logs -f

# Specific service
docker compose -f docker/compose.yml logs -f rox-backend
docker compose -f docker/compose.yml logs -f rox-frontend
docker compose -f docker/compose.yml logs -f nginx
docker compose -f docker/compose.yml logs -f postgres
```

### Restart Services

```bash
# Restart all
docker compose -f docker/compose.yml restart

# Restart specific service
docker compose -f docker/compose.yml restart rox-backend
docker compose -f docker/compose.yml restart nginx
```

### Update Deployment

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker/compose.yml build
docker compose -f docker/compose.yml up -d

# Or force recreate
docker compose -f docker/compose.yml up -d --force-recreate
```

### Database Backup

```bash
# Create backup
docker exec rox-postgres pg_dump -U rox rox > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker exec -i rox-postgres psql -U rox rox < backup_20251126_120000.sql
```

### Stop Services

```bash
# Stop all services (keeps data)
docker compose -f docker/compose.yml down

# Stop and remove volumes (DESTROYS DATA)
docker compose -f docker/compose.yml down -v
```

## Monitoring

### Prometheus Metrics

Rox exposes Prometheus metrics at `/metrics`:

```bash
curl -s https://your-domain.com/metrics
```

Available metrics:
- `rox_http_requests_total` - HTTP request counts
- `rox_http_request_duration_seconds` - Request latency
- `rox_activitypub_delivery_total` - AP delivery counts
- `rox_activitypub_inbox_total` - Inbox activity counts
- `rox_db_queries_total` - Database query counts
- `rox_cache_operations_total` - Cache hit/miss counts

### Health Checks

Docker automatically monitors service health. View status:

```bash
docker inspect --format='{{json .State.Health}}' rox-backend | jq
```

## S3/R2 Storage Configuration

For production, consider using S3-compatible storage:

```ini
# .env.production
STORAGE_TYPE=s3
S3_ENDPOINT=https://your-bucket.r2.cloudflarestorage.com
S3_BUCKET_NAME=rox-media
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=auto
S3_PUBLIC_URL=https://cdn.your-domain.com
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

## Session Lost - Re-set Variables

If you closed your terminal and need to continue:

```bash
# Set your values again
export ROX_DOMAIN="rox.example.com"
export ROX_DB_PASSWORD="your-saved-password"
export ROX_ADMIN_EMAIL="admin@example.com"
```

## Troubleshooting

See [Troubleshooting Guide](./troubleshooting.md) for common issues and solutions.

### Quick Diagnostics

```bash
# Check all container status
docker compose -f docker/compose.yml ps

# Check resource usage
docker stats

# Check disk space
df -h

# Check nginx config syntax
docker exec rox-nginx nginx -t

# Test trailing slash redirect
curl -I http://localhost/timeline/
# Should return: HTTP/1.1 301 Moved Permanently
# Location: http://localhost/timeline
```

## Security Checklist

- [ ] Strong PostgreSQL password generated (auto-generated with `ROX_DB_PASSWORD`)
- [ ] Registration disabled after admin account created
- [ ] Firewall configured (only 80, 443 open)
- [ ] Regular backups scheduled
- [ ] SSL configured (Cloudflare, Traefik, or external nginx)
- [ ] Server updates enabled
- [ ] Configuration values saved securely
