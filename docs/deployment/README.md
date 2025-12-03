# Deployment Documentation

**Languages**: English | [日本語](./README.ja.md)

Guides for deploying Rox in various environments.

## Deployment Options

| Environment | Guide | Complexity | Best For |
|-------------|-------|------------|----------|
| VPS (Docker) | [vps-docker.md](./vps-docker.md) | Easy | Quick setup, isolated services |
| VPS (Bare Metal) | [bare-metal.md](./bare-metal.md) | Medium | Maximum performance, low RAM |
| Cloudflare Workers | Coming Soon | - | Edge deployment |
| Kubernetes | Coming Soon | - | Large scale deployments |

## Choosing a Deployment Method

### Docker Deployment (Recommended for Most Users)

**Advantages:**
- Simpler setup process
- Isolated services with easy cleanup
- Consistent across different Linux distributions
- Built-in service orchestration

**Best for:**
- First-time deployers
- Teams familiar with Docker
- Servers with 2GB+ RAM
- Quick prototyping and testing

### Bare Metal Deployment

**Advantages:**
- No container overhead (~100-200MB RAM saved)
- Direct system access for debugging
- Native performance
- More control over each component

**Best for:**
- Resource-constrained servers (<2GB RAM)
- Experienced Linux administrators
- Maximum performance requirements
- Custom configurations

## Quick Links

- **[Installation Guide](./installation-guide.md)** - Complete step-by-step deployment guide (Recommended)
- [VPS Docker Deployment](./vps-docker.md) - Deploy with Docker Compose
- [Bare Metal Deployment](./bare-metal.md) - Deploy directly on Linux
- [Nginx Configuration](./nginx-configuration.md) - Nginx reverse proxy setup with SSE support
- [Environment Variables](./environment-variables.md) - Complete configuration reference
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

## Minimum Requirements

### Hardware Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 1 GB (bare metal) / 2 GB (Docker) | 4 GB |
| Storage | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 |

### Software Requirements

**Docker Deployment:**
- Docker Engine 24.0+
- Docker Compose v2
- Domain with DNS access

**Bare Metal Deployment:**
- Bun runtime
- PostgreSQL 14+
- Dragonfly or Redis (optional)
- Caddy or Nginx
- Domain with DNS access

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │    Caddy      │  Automatic HTTPS
                    │  (Reverse     │  HTTP/2, HTTP/3
                    │   Proxy)      │
                    └───────┬───────┘
                            │
                    ┌───────┴───────┐
                    │     Rox       │  Hono + Bun
                    │   Backend     │  ActivityPub
                    └───────┬───────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
┌────────┴────────┐ ┌──────┴──────┐ ┌────────┴────────┐
│   PostgreSQL    │ │  Dragonfly  │ │     Storage     │
│   (Database)    │ │  (Cache/    │ │   (Local/S3)    │
│                 │ │   Queue)    │ │                 │
└─────────────────┘ └─────────────┘ └─────────────────┘
```

## Security Checklist

Before going to production:

- [ ] Use strong, unique passwords for database
- [ ] Disable registration after creating admin account
- [ ] Ensure firewall only exposes ports 80 and 443
- [ ] Set up automated backups
- [ ] Configure monitoring and alerting
- [ ] Review rate limiting configuration
- [ ] Test federation with other instances

## Support

- [GitHub Issues](https://github.com/your-org/rox/issues) - Bug reports and feature requests
- [Discussions](https://github.com/your-org/rox/discussions) - Questions and community support
