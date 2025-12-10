# Caddy Configuration (Deprecated)

**Status: Deprecated**

This Caddy configuration has been deprecated in favor of Nginx.

## Why Nginx?

- Better control over content negotiation for ActivityPub
- More flexible trailing slash handling
- Industry-standard configuration format
- Consistent with most production deployments

## Migration

Use the new Nginx-based configuration:

```bash
docker compose -f docker/docker-compose.prod.yml up -d
```

The new configuration includes:
- `docker/nginx/nginx.conf` - Main Nginx configuration
- `docker/nginx/conf.d/default.conf` - Site-specific configuration
- Trailing slash redirect (e.g., `/timeline/` → `/timeline`)
- Content negotiation for `/notes/` (ActivityPub vs Browser)
- Frontend (Waku) and Backend (Hono) routing

## SSL Termination

For HTTPS, use one of:
- Cloudflare Tunnel or Proxy
- Traefik with Let's Encrypt
- External nginx with SSL certificates

See `docs/deployment/nginx.conf.example` for a complete SSL configuration.
