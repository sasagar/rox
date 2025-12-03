# Troubleshooting Guide

Common issues and solutions for Rox deployments.

## Quick Diagnostics

Run these commands to gather diagnostic information:

```bash
# Check container status
docker compose -f docker/docker-compose.prod.yml ps

# Check recent logs
docker compose -f docker/docker-compose.prod.yml logs --tail=100

# Check resource usage
docker stats --no-stream

# Check disk space
df -h

# Test health endpoint
curl -s https://your-domain.com/health/ready | jq
```

## Startup Issues

### Container Fails to Start

**Symptoms:** Container exits immediately or enters restart loop.

**Check logs:**
```bash
docker compose -f docker/docker-compose.prod.yml logs rox
```

**Common causes:**

1. **Missing environment variables**
   ```
   Error: POSTGRES_PASSWORD is required
   ```
   Solution: Ensure `.env.production` exists and contains required variables.

2. **Database not ready**
   ```
   Error: ECONNREFUSED postgres:5432
   ```
   Solution: Wait for PostgreSQL to be healthy, or check `depends_on` configuration.

3. **Port already in use**
   ```
   Error: listen EADDRINUSE: address already in use :::3000
   ```
   Solution: Stop conflicting process or change `PORT` in environment.

### PostgreSQL Connection Failed

**Symptoms:**
```
Error: connection refused to database
```

**Solutions:**

1. Check PostgreSQL is running:
   ```bash
   docker compose -f docker/docker-compose.prod.yml ps postgres
   docker compose -f docker/docker-compose.prod.yml logs postgres
   ```

2. Verify credentials match in `.env.production`

3. Check network connectivity:
   ```bash
   docker exec rox-api ping postgres
   ```

### Dragonfly/Redis Connection Failed

**Symptoms:**
```
Warning: Redis not available, using synchronous delivery fallback
```

**Note:** This is a warning, not an error. Rox will work without Redis but ActivityPub delivery will be slower.

**Solutions:**

1. Check Dragonfly is running:
   ```bash
   docker compose -f docker/docker-compose.prod.yml ps dragonfly
   ```

2. Test connectivity:
   ```bash
   docker exec rox-dragonfly redis-cli ping
   ```

## Nginx Rate Limiting Issues (503 Errors)

### Symptoms

- Browser console shows `503 (Service Unavailable)` errors
- Multiple API requests fail on page load
- SSE connections disconnect frequently
- JSON parse errors (`Unexpected token '<'`) due to HTML error pages

### Diagnosis

Check Nginx error logs:
```bash
grep -E "(limiting|limit_req|limit_conn|503)" /var/log/nginx/rox.error.log | tail -50
```

### Common Errors and Solutions

#### `limiting requests, excess: XX by zone "api_limit"`

The API rate limit is too restrictive. Rox's frontend makes many concurrent API calls on page load (reactions for each note, instance info, user avatars, etc.).

**Fix:**
```nginx
# In the limit_req_zone definition (outside server block)
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=50r/s;

# In location /api/ block
limit_req zone=api_limit burst=100 nodelay;
```

#### `limiting connections by zone "sse_conn"`

SSE connection limit is too low. Multiple browser tabs, reconnection attempts after network issues, and mobile background activity can quickly exhaust low limits.

**Fix:**
```nginx
# In location /api/notifications/stream block
limit_conn sse_conn 50;
```

#### `upstream prematurely closed connection`

This is normal behavior for Rox's SSE implementation which uses short-lived connections. The frontend handles reconnection automatically.

### After Making Changes

```bash
nginx -t && systemctl reload nginx
```

---

## SSL/HTTPS Issues

### Certificate Not Issued

**Symptoms:** Browser shows "Not Secure" or certificate errors.

**Check Caddy logs:**
```bash
docker compose -f docker/docker-compose.prod.yml logs caddy
```

**Common causes:**

1. **DNS not propagated**
   ```bash
   # Check DNS resolution
   dig +short your-domain.com
   ```
   Solution: Wait for DNS propagation or check A record.

2. **Port 80/443 blocked**
   ```bash
   # Test from another machine
   nc -zv your-server-ip 80
   nc -zv your-server-ip 443
   ```
   Solution: Configure firewall to allow ports 80 and 443.

3. **Rate limited by Let's Encrypt**
   Check: https://crt.sh/?q=your-domain.com
   Solution: Wait 1 hour or use staging environment for testing.

### Certificate Renewal Failed

**Check Caddy certificate status:**
```bash
docker exec rox-caddy caddy list-certificates
```

**Force renewal:**
```bash
docker compose -f docker/docker-compose.prod.yml restart caddy
```

## ActivityPub Federation Issues

### Remote Server Cannot Reach Instance

**Symptoms:** Follow requests from other servers fail.

**Diagnostics:**

1. Check WebFinger:
   ```bash
   curl -s "https://your-domain.com/.well-known/webfinger?resource=acct:username@your-domain.com"
   ```

2. Check actor endpoint:
   ```bash
   curl -s -H "Accept: application/activity+json" "https://your-domain.com/users/username"
   ```

**Common causes:**

1. **Incorrect ROX_URL**
   Solution: Ensure `ROX_URL` matches your actual domain with `https://`.

2. **Firewall blocking incoming requests**
   Solution: Ensure ports 80 and 443 are open for incoming traffic.

### Outbound Delivery Failing

**Symptoms:** Posts not appearing on remote servers, follows not working.

**Check delivery logs:**
```bash
docker compose -f docker/docker-compose.prod.yml logs rox | grep -i "delivery\|inbox"
```

**Common causes:**

1. **HTTP Signature issues**
   Check logs for signature-related errors.

2. **Remote server unreachable**
   ```bash
   docker exec rox-api curl -I https://remote-server.com
   ```

3. **Rate limited by remote server**
   Wait and try again. Rox has built-in retry logic.

## Performance Issues

### High Memory Usage

**Check memory usage:**
```bash
docker stats --no-stream
```

**Solutions:**

1. Adjust resource limits in `docker-compose.prod.yml`

2. Reduce Dragonfly memory:
   ```yaml
   command: dragonfly --maxmemory=128mb
   ```

3. Check for memory leaks in logs

### Slow Response Times

**Check metrics:**
```bash
curl -s https://your-domain.com/metrics | grep duration
```

**Solutions:**

1. Check database query performance:
   ```bash
   docker exec rox-postgres psql -U rox -c "SELECT * FROM pg_stat_activity;"
   ```

2. Check disk I/O:
   ```bash
   iostat -x 1 5
   ```

3. Add database indexes if needed

### High CPU Usage

**Identify the cause:**
```bash
docker stats --no-stream
docker top rox-api
```

**Solutions:**

1. Check for runaway processes
2. Review recent code changes
3. Scale horizontally if needed

## Database Issues

### Database Migration Failed

**Symptoms:** Application fails to start with schema errors.

**Run migrations manually:**
```bash
docker exec rox-api bun run db:migrate
```

### Database Full

**Check disk usage:**
```bash
docker exec rox-postgres psql -U rox -c "SELECT pg_size_pretty(pg_database_size('rox'));"
```

**Solutions:**

1. Expand volume or disk
2. Clean up old data:
   ```sql
   -- Delete old sessions (example)
   DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '30 days';
   ```

### Connection Pool Exhausted

**Symptoms:**
```
Error: too many connections
```

**Solutions:**

1. Increase PostgreSQL max connections
2. Check for connection leaks in application
3. Reduce connection pool size

## Storage Issues

### Upload Failed

**Symptoms:** File uploads return errors.

**For local storage:**
```bash
# Check permissions
docker exec rox-api ls -la /app/uploads

# Check disk space
docker exec rox-api df -h /app/uploads
```

**For S3 storage:**
```bash
# Check S3 configuration
docker exec rox-api env | grep S3
```

### Files Not Accessible

**Check storage configuration:**
```bash
docker exec rox-api env | grep STORAGE
```

**For S3:**
- Verify bucket permissions
- Check `S3_PUBLIC_URL` if using CDN

## Logging and Debugging

### Enable Debug Logging

```bash
# In .env.production
LOG_LEVEL=debug

# Restart
docker compose -f docker/docker-compose.prod.yml restart rox
```

### View Structured Logs

```bash
# Parse JSON logs
docker compose -f docker/docker-compose.prod.yml logs rox | jq -R 'fromjson? // .'

# Filter by level
docker compose -f docker/docker-compose.prod.yml logs rox | jq -R 'fromjson? | select(.level == "error")'
```

### Export Logs for Analysis

```bash
docker compose -f docker/docker-compose.prod.yml logs --no-color > rox-logs-$(date +%Y%m%d).txt
```

## Recovery Procedures

### Restore from Backup

```bash
# Stop application
docker compose -f docker/docker-compose.prod.yml stop rox

# Restore database
docker exec -i rox-postgres psql -U rox rox < backup.sql

# Start application
docker compose -f docker/docker-compose.prod.yml start rox
```

### Reset to Clean State

**WARNING: This destroys all data!**

```bash
# Stop and remove everything
docker compose -f docker/docker-compose.prod.yml down -v

# Start fresh
docker compose -f docker/docker-compose.prod.yml up -d
```

## Getting Help

If you're still stuck:

1. Check existing issues: https://github.com/your-org/rox/issues
2. Create a new issue with:
   - Docker and OS versions
   - Relevant logs (sanitized)
   - Steps to reproduce
   - Expected vs actual behavior
