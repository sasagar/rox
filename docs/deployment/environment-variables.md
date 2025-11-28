# Environment Variables Reference

Complete reference for all environment variables used by Rox.

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ROX_URL` | Full public URL of your instance | `https://rox.example.com` |
| `ROX_DOMAIN` | Domain name (without protocol) | `rox.example.com` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `POSTGRES_PASSWORD` | PostgreSQL password (Docker) | `your-secure-password` |

## Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_TYPE` | Database type | `postgres` |
| `DATABASE_URL` | Connection string | Required |
| `POSTGRES_USER` | PostgreSQL username (Docker) | `rox` |
| `POSTGRES_DB` | PostgreSQL database name (Docker) | `rox` |

### Supported DB_TYPE Values

- `postgres` - PostgreSQL (recommended for production)
- `mysql` - MySQL/MariaDB
- `sqlite` - SQLite (development only)
- `d1` - Cloudflare D1 (edge deployment)

## Server Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend HTTP server port | `3000` |
| `FRONTEND_PORT` | Frontend (Waku) server port | `3001` |
| `NODE_ENV` | Environment mode | `development` |
| `URL` | Public URL (alias for ROX_URL) | Required |

### NODE_ENV Values

- `development` - Pretty logging, relaxed security
- `production` - JSON logging, HSTS enabled, strict security

## Storage Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `STORAGE_TYPE` | Storage backend type | `local` |
| `LOCAL_STORAGE_PATH` | Local file storage path | `./uploads` |

### S3-Compatible Storage

Required when `STORAGE_TYPE=s3`:

| Variable | Description | Example |
|----------|-------------|---------|
| `S3_ENDPOINT` | S3/R2 endpoint URL | `https://bucket.s3.amazonaws.com` |
| `S3_BUCKET_NAME` | Bucket name | `rox-media` |
| `S3_ACCESS_KEY` | Access key ID | `AKIAIOSFODNN7EXAMPLE` |
| `S3_SECRET_KEY` | Secret access key | `wJalrXUtnFEMI/K7MDENG...` |
| `S3_REGION` | AWS region | `us-east-1` or `auto` |
| `S3_PUBLIC_URL` | Public CDN URL (optional) | `https://cdn.example.com` |

## Authentication & Sessions

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_REGISTRATION` | Allow new user registration | `false` |
| `SESSION_EXPIRY_DAYS` | Session token lifetime in days | `30` |

## Cache & Queue (Dragonfly/Redis)

| Variable | Description | Default |
|----------|-------------|---------|
| `DRAGONFLY_URL` | Redis-compatible connection URL | `redis://localhost:6379` |
| `USE_QUEUE` | Enable BullMQ job queue | `true` (when Redis available) |

## Logging

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Minimum log level | `info` |
| `STATS_LOG_INTERVAL_MS` | Delivery stats log interval (ms) | `3600000` (1 hour) |

### Log Levels

- `trace` - Most verbose, includes all details
- `debug` - Debug information
- `info` - General operational information (default)
- `warn` - Warning conditions
- `error` - Error conditions only
- `fatal` - Critical errors only

## TLS/HTTPS (Caddy)

| Variable | Description | Default |
|----------|-------------|---------|
| `ACME_EMAIL` | Email for Let's Encrypt notifications | Required |

## Docker-Specific Variables

These are only used in Docker Compose deployments:

| Variable | Description | Docker Default |
|----------|-------------|----------------|
| `POSTGRES_USER` | Database username | `rox` |
| `POSTGRES_PASSWORD` | Database password | Required |
| `POSTGRES_DB` | Database name | `rox` |
| `ROX_DOMAIN` | Domain for Caddy | `rox.example.com` |

## Example Configurations

### Minimal Production

```ini
ROX_URL=https://rox.example.com
ROX_DOMAIN=rox.example.com
POSTGRES_PASSWORD=your-secure-password
ACME_EMAIL=admin@example.com
ENABLE_REGISTRATION=false
```

### Development

```ini
NODE_ENV=development
PORT=3000
DB_TYPE=postgres
DATABASE_URL=postgresql://rox:dev_password@localhost:5432/rox
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./uploads
URL=http://localhost:3000
ENABLE_REGISTRATION=true
LOG_LEVEL=debug
```

### Production with S3 Storage

```ini
NODE_ENV=production
ROX_URL=https://rox.example.com
ROX_DOMAIN=rox.example.com
POSTGRES_PASSWORD=your-secure-password
ACME_EMAIL=admin@example.com
ENABLE_REGISTRATION=false
SESSION_EXPIRY_DAYS=30
LOG_LEVEL=info

STORAGE_TYPE=s3
S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com
S3_BUCKET_NAME=rox-media
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=auto
S3_PUBLIC_URL=https://cdn.your-domain.com
```

### Production with External PostgreSQL

```ini
NODE_ENV=production
ROX_URL=https://rox.example.com
DATABASE_URL=postgresql://user:password@db.provider.com:5432/rox?sslmode=require
DRAGONFLY_URL=redis://redis.provider.com:6379
STORAGE_TYPE=s3
# ... S3 config ...
```

## Security Notes

1. **Never commit secrets** - Use `.env` files or environment injection
2. **Generate strong passwords** - Use `openssl rand -base64 32`
3. **Disable registration** - Set `ENABLE_REGISTRATION=false` after initial setup
4. **Use HTTPS** - Always use `https://` in `ROX_URL` for production
5. **Protect metrics** - `/metrics` endpoint should be internal-only in production
