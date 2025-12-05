# Nginx Configuration Guide for Rox

This guide provides Nginx configuration for deploying Rox in production environments.

## Architecture Overview

Rox consists of two components served from the same domain:

- **Frontend (Waku)**: React application served on port 3001
- **Backend (Hono)**: API server served on port 3000

```
                    ┌─────────────────────────────────────┐
                    │              Nginx                  │
                    │         (rox.example.com)           │
                    │                                     │
    HTTPS :443      │   ┌─────────────────────────────┐   │
   ─────────────────┼──►│  SSL Termination            │   │
                    │   └─────────────────────────────┘   │
                    │                 │                   │
                    │    ┌────────────┴────────────┐      │
                    │    │                         │      │
                    │    ▼                         ▼      │
                    │ /api/*                    /* (else) │
                    │ /.well-known/*                      │
                    │ /nodeinfo/*                         │
                    │ /users/*                            │
                    │ /notes/*                            │
                    │                                     │
                    └────┬────────────────────────┬───────┘
                         │                        │
                         ▼                        ▼
                 ┌───────────────┐       ┌───────────────┐
                 │   Backend     │       │   Frontend    │
                 │  (Hono API)   │       │    (Waku)     │
                 │  port 3000    │       │  port 3001    │
                 └───────────────┘       └───────────────┘
```

## Basic Configuration

### `/etc/nginx/sites-available/rox.conf`

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
# IMPORTANT: Rox frontend makes many concurrent API calls on page load
# (reactions, instance info, avatars for each note). Lower values cause 503 errors.
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=50r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;
limit_conn_zone $binary_remote_addr zone=sse_conn:10m;

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name rox.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name rox.example.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/rox.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rox.example.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logging
    access_log /var/log/nginx/rox.access.log;
    error_log /var/log/nginx/rox.error.log;

    # Client body size for file uploads
    client_max_body_size 20M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # ===========================================
    # Backend API Routes
    # ===========================================

    # API endpoints
    location /api/ {
        limit_req zone=api_limit burst=100 nodelay;

        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # ===========================================
    # WebSocket Routes (Real-time streaming)
    # ===========================================

    # WebSocket endpoints for real-time updates
    location /ws/ {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket-specific headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Long timeout for persistent WebSocket connections
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;

        # Disable buffering for real-time communication
        proxy_buffering off;
    }

    # ===========================================
    # SSE Routes (Legacy, kept for compatibility)
    # ===========================================

    # SSE endpoint (special configuration for long-lived connections)
    location /api/notifications/stream {
        limit_conn sse_conn 50;  # Multiple tabs, reconnections need higher limit

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
        proxy_send_timeout 86400s;

        # Disable chunked transfer encoding issues
        chunked_transfer_encoding off;
    }

    # Auth endpoints (stricter rate limiting)
    location /api/auth/ {
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

    # WebFinger
    location /.well-known/webfinger {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Cache WebFinger responses
        proxy_cache_valid 200 5m;
    }

    # NodeInfo
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

    # ActivityPub Actor endpoints
    location /users/ {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ActivityPub Note endpoints
    location /notes/ {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ===========================================
    # Health Check Endpoints
    # ===========================================

    location /health {
        proxy_pass http://rox_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Allow internal monitoring
        # allow 10.0.0.0/8;
        # deny all;
    }

    # ===========================================
    # Static Files (if using local storage)
    # ===========================================

    location /uploads/ {
        alias /var/www/rox/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";

        # Security: prevent script execution
        location ~* \.(php|cgi|pl|py)$ {
            deny all;
        }
    }

    # ===========================================
    # Frontend (Waku) - Default route
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

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            proxy_pass http://rox_frontend;
            expires 7d;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

## SSE-Specific Considerations

### Why SSE Needs Special Configuration

Server-Sent Events (SSE) require long-lived HTTP connections. Standard proxy configurations will timeout these connections.

Key settings for SSE:

```nginx
location /api/notifications/stream {
    # Disable buffering - SSE events must be sent immediately
    proxy_buffering off;

    # Disable caching
    proxy_cache off;

    # Long timeout for persistent connections (24 hours)
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;

    # Prevent chunked encoding issues
    chunked_transfer_encoding off;

    # Limit connections per IP to prevent abuse
    limit_conn sse_conn 5;
}
```

### Connection Limits

The `limit_conn sse_conn 50` directive limits each IP address to 50 concurrent SSE connections. This high limit is necessary because:

- Multiple browser tabs open SSE connections
- Network issues cause reconnection attempts (can stack up quickly)
- Mobile apps may keep background connections

**Recommended values:**
- **Default**: 50 connections (handles most scenarios)
- **High traffic**: 100+ connections
- **No limit**: Remove the `limit_conn` directive (not recommended)

## Docker Compose Integration

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/rox.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx/ssl:/etc/letsencrypt:ro
      - ./uploads:/var/www/rox/uploads:ro
    depends_on:
      - backend
      - frontend
    networks:
      - rox-network

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    environment:
      - DB_TYPE=postgres
      - DATABASE_URL=postgresql://rox:password@db:5432/rox
      - STORAGE_TYPE=local
      - LOCAL_STORAGE_PATH=/app/uploads
      - PORT=3000
      - NODE_ENV=production
      - URL=https://rox.example.com
    volumes:
      - ./uploads:/app/uploads
    networks:
      - rox-network

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    environment:
      - PORT=3001
      - NODE_ENV=production
    networks:
      - rox-network

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=rox
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=rox
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - rox-network

networks:
  rox-network:
    driver: bridge

volumes:
  postgres_data:
```

### Docker Nginx Configuration

When using Docker, update the upstream definitions:

```nginx
upstream rox_backend {
    server backend:3000;
    keepalive 64;
}

upstream rox_frontend {
    server frontend:3001;
    keepalive 32;
}
```

## SSL Certificate Setup

### Using Certbot (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d rox.example.com

# Auto-renewal (add to crontab)
0 0 * * * /usr/bin/certbot renew --quiet
```

### Using Cloudflare (Origin Certificate)

If using Cloudflare as a proxy:

1. Generate Origin Certificate in Cloudflare dashboard
2. Save certificate and key to `/etc/nginx/ssl/`
3. Update nginx configuration:

```nginx
ssl_certificate /etc/nginx/ssl/cloudflare-origin.pem;
ssl_certificate_key /etc/nginx/ssl/cloudflare-origin.key;
```

## Monitoring and Troubleshooting

### Check SSE Connections

```bash
# View active SSE connections
curl -s http://localhost:3000/health/sse | jq

# Monitor Nginx connections
watch -n 1 'ss -tnp | grep nginx | wc -l'
```

### Nginx Status Module

Add to server block for monitoring:

```nginx
location /nginx_status {
    stub_status on;
    allow 127.0.0.1;
    deny all;
}
```

### Common Issues

#### SSE connections dropping

1. Check `proxy_read_timeout` is set high enough
2. Verify `proxy_buffering off` is set
3. Check upstream keepalive settings

#### 502 Bad Gateway

1. Verify backend is running: `curl http://localhost:3000/health`
2. Check Nginx error logs: `tail -f /var/log/nginx/rox.error.log`

#### File uploads failing

1. Increase `client_max_body_size`
2. Check file permissions on upload directory

## Performance Tuning

### Worker Processes

```nginx
# /etc/nginx/nginx.conf
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}
```

### TCP Optimization

```nginx
http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
}
```

## Security Checklist

- [ ] SSL/TLS properly configured (TLS 1.2+)
- [ ] HSTS header enabled
- [ ] Rate limiting on API endpoints
- [ ] Rate limiting on auth endpoints
- [ ] SSE connection limits configured
- [ ] File upload size limited
- [ ] Security headers set (X-Frame-Options, etc.)
- [ ] Access logs enabled
- [ ] Error logs monitored
- [ ] Firewall configured (only 80/443 exposed)
