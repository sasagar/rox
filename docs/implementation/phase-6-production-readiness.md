# Phase 6: Production Readiness Plan

**Created:** 2025-11-26
**Updated:** 2025-11-26
**Status:** In Progress

## Overview

Phase 6 focuses on making Rox production-ready with proper deployment configuration, monitoring, security hardening, and additional test coverage.

---

## 1. Production Deployment

### 1.1 Docker Compose Production Configuration (High Priority) ✅ COMPLETE

**Current State:**
- ~~Development Docker Compose exists for PostgreSQL and Dragonfly~~
- ~~No production-ready configuration~~
- Full production deployment stack available

**Tasks:**
- [x] Create `docker-compose.prod.yml` with:
  - Rox backend service with health checks
  - PostgreSQL with volume persistence
  - Dragonfly with persistence
  - Caddy reverse proxy with automatic HTTPS
- [x] Create `.env.production.example` template
- [x] Add resource limits (memory, CPU)
- [x] Configure restart policies
- [x] Add logging configuration

**Files Created:**
```
docker/
├── Dockerfile                  # Multi-stage build for backend
├── docker-compose.prod.yml     # Production stack
├── docker-compose.dev.yml      # Development dependencies
├── caddy/
│   └── Caddyfile              # Automatic HTTPS reverse proxy
└── .env.production.example    # Environment template
```

**Features:**
- Multi-stage Docker build (builder + production)
- Non-root user for security
- Health checks on all services
- Resource limits and reservations
- JSON logging with rotation
- Automatic HTTPS via Caddy + Let's Encrypt

**Estimated Impact:** Essential for self-hosting ✅ Achieved

---

### 1.2 Health Check Endpoints (High Priority) ✅ COMPLETE

**Tasks:**
- [x] Create `/health` endpoint (basic liveness check)
- [x] Create `/health/ready` endpoint (readiness check with DB/cache status)
- [ ] Add health check to Docker Compose configuration

**Implementation:**
```typescript
// routes/health.ts
GET /health          → { status: 'ok', timestamp, version, uptime }
GET /health/ready    → { status: 'ok'|'degraded'|'unhealthy', checks: { database, cache } }
```

**Files Created:**
- `packages/backend/src/routes/health.ts` - Health check routes with DB/cache verification

**Estimated Impact:** Required for container orchestration ✅ Achieved

---

### 1.3 Graceful Shutdown (Medium Priority) ✅ COMPLETE

**Tasks:**
- [x] Handle SIGTERM/SIGINT signals
- [x] Close database connections gracefully
- [x] Drain activity delivery queue
- [x] Stop accepting new requests during shutdown
- [x] Add 30-second shutdown timeout

**Implementation:**
- `gracefulShutdown()` function in index.ts
- Stops cleanup service first
- Drains ActivityDeliveryQueue (logs final statistics)
- 30-second timeout prevents hanging
- Double-signal protection (ignores duplicate signals)

**Estimated Impact:** Prevents data loss during deployments ✅ Achieved

---

## 2. Monitoring & Observability

### 2.1 Structured Logging (High Priority)

**Current State:**
- Console.log statements throughout codebase
- No log levels or structured format

**Tasks:**
- [ ] Choose logging library (pino recommended for Bun)
- [ ] Implement structured JSON logging
- [ ] Add log levels (debug, info, warn, error)
- [ ] Add request ID tracking
- [ ] Add correlation IDs for ActivityPub delivery

**Log Format:**
```json
{
  "level": "info",
  "time": "2025-11-26T12:00:00Z",
  "requestId": "abc123",
  "message": "Activity delivered",
  "activityType": "Create",
  "targetInbox": "https://example.com/inbox",
  "duration": 234
}
```

**Estimated Impact:** Essential for debugging production issues

---

### 2.2 Metrics Collection (Medium Priority)

**Tasks:**
- [ ] Add Prometheus-compatible metrics endpoint `/metrics`
- [ ] Track key metrics:
  - HTTP request count/duration by endpoint
  - ActivityPub delivery success/failure rates
  - Database query counts
  - Cache hit/miss rates
  - Queue depth
- [ ] Create Grafana dashboard template

**Estimated Impact:** Enables performance monitoring and alerting

---

### 2.3 Error Tracking (Medium Priority)

**Tasks:**
- [ ] Integrate error tracking (Sentry recommended)
- [ ] Add breadcrumbs for debugging
- [ ] Configure source maps for production builds
- [ ] Set up alert rules for critical errors

**Estimated Impact:** Faster incident response

---

## 3. Security Hardening

### 3.1 Rate Limiting for Public Endpoints (High Priority) ✅ COMPLETE

**Current State:**
- ActivityPub delivery has rate limiting
- ~~Public API endpoints have no rate limiting~~ Now rate limited

**Tasks:**
- [x] Add rate limiting middleware
- [x] Configure limits per endpoint:
  - `/api/auth/register`: 5 req/hour per IP
  - `/api/auth/login`: 10 req/minute per IP
  - `/api/notes/create`: 60 req/minute per user
  - `/inbox`: 100 req/minute per server
- [x] Add rate limit headers (X-RateLimit-*)
- [x] Store rate limit data in Dragonfly

**Files Created:**
- `packages/backend/src/middleware/rateLimit.ts` - Sliding window rate limiter with presets

**Features:**
- `rateLimit()` - IP-based rate limiting
- `userRateLimit()` - User ID or IP-based rate limiting
- `inboxRateLimit()` - Server hostname-based rate limiting
- `RateLimitPresets` - Predefined configurations for common use cases
- X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After headers

**Estimated Impact:** Prevents abuse and DoS ✅ Achieved

---

### 3.2 Security Headers (High Priority) ✅ COMPLETE

**Tasks:**
- [x] Add security headers middleware:
  - Content-Security-Policy
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - Strict-Transport-Security (production only)
  - Referrer-Policy
  - Permissions-Policy
- [x] Configure CORS properly for API endpoints

**Files Created:**
- `packages/backend/src/middleware/securityHeaders.ts` - OWASP-compliant security headers

**Features:**
- `securityHeaders()` - Configurable security headers middleware
- `activityPubSecurityHeaders()` - Relaxed headers for ActivityPub endpoints
- HSTS automatically enabled in production
- Cache-Control headers for API responses

**Estimated Impact:** Prevents common web vulnerabilities ✅ Achieved

---

### 3.3 Input Validation Audit (Medium Priority)

**Tasks:**
- [ ] Review all API endpoints for input validation
- [ ] Add Zod schemas for all request bodies
- [ ] Validate URL parameters and query strings
- [ ] Sanitize HTML in user-generated content

**Estimated Impact:** Prevents injection attacks

---

### 3.4 Secrets Management (Medium Priority)

**Tasks:**
- [ ] Document required secrets
- [ ] Add secret rotation capability
- [ ] Never log sensitive data
- [ ] Add warning for weak SESSION_SECRET

**Estimated Impact:** Improves security posture

---

## 4. Additional Test Coverage

### 4.1 ActivityPub Inbox Integration Tests (High Priority)

**Current State:**
- Manual test scripts in `~/rox-testing/`
- No automated inbox tests

**Tasks:**
- [ ] Convert manual test scripts to automated tests
- [ ] Create test fixtures for all activity types
- [ ] Add HTTP Signature verification tests
- [ ] Test error handling scenarios

**Test Coverage:**
- Follow, Undo Follow
- Create Note, Update Note, Delete Note
- Like, Undo Like
- Announce, Undo Announce
- Accept, Reject

**Estimated Impact:** Prevents federation regressions

---

### 4.2 Delivery Queue Tests (Medium Priority)

**Tasks:**
- [ ] Test queue initialization
- [ ] Test job processing
- [ ] Test retry logic
- [ ] Test rate limiting behavior
- [ ] Test graceful shutdown

**Estimated Impact:** Ensures reliable delivery

---

### 4.3 E2E Tests (Low Priority)

**Tasks:**
- [ ] Set up Playwright or similar
- [ ] Test authentication flow
- [ ] Test note creation/deletion
- [ ] Test timeline loading

**Estimated Impact:** Catches UI integration issues

---

## 5. Documentation

### 5.1 Deployment Guide (High Priority)

**Tasks:**
- [ ] Create `docs/deployment/vps-docker.md`
- [ ] Create `docs/deployment/cloudflare-workers.md` (future)
- [ ] Document environment variables
- [ ] Add troubleshooting guide

---

### 5.2 API Documentation (Medium Priority)

**Tasks:**
- [ ] Generate OpenAPI spec from routes
- [ ] Add Swagger UI endpoint
- [ ] Document rate limits and authentication

---

## Implementation Order

### Sprint 1: Core Production Requirements (Week 1) ✅ COMPLETE

1. **Health Check Endpoints** (1.2) ✅
   - Basic liveness and readiness checks
   - Essential for container orchestration

2. **Security Headers** (3.2) ✅
   - Quick win for security
   - No breaking changes

3. **Rate Limiting** (3.1) ✅
   - Protect public endpoints
   - Prevent abuse

### Sprint 2: Deployment & Logging (Week 2) - IN PROGRESS

4. **Docker Compose Production** (1.1) ✅
   - Complete production deployment setup
   - Environment configuration

5. **Structured Logging** (2.1)
   - Replace console.log
   - Add request tracking

6. **Graceful Shutdown** (1.3) ✅
   - Handle signals properly
   - Drain connections

### Sprint 3: Monitoring & Testing (Week 3)

7. **ActivityPub Inbox Tests** (4.1)
   - Automate manual tests
   - Prevent regressions

8. **Metrics Collection** (2.2)
   - Prometheus endpoint
   - Key performance metrics

9. **Delivery Queue Tests** (4.2)
   - Test queue behavior
   - Ensure reliability

### Sprint 4: Polish & Documentation (Week 4)

10. **Input Validation Audit** (3.3)
    - Review all endpoints
    - Add missing validation

11. **Error Tracking** (2.3)
    - Sentry integration
    - Alert configuration

12. **Documentation** (5.1, 5.2)
    - Deployment guide
    - API documentation

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Health check endpoints | 2 endpoints | ✅ Complete (2/2) |
| Security headers | All OWASP headers | ✅ Complete (7 headers) |
| Rate limiting coverage | 100% public endpoints | ✅ Complete (4 presets) |
| Structured logging | All log statements | Pending |
| Inbox test coverage | 11 activity types | Pending |
| Documentation | Complete deployment guide | Pending |

---

## Risk Mitigation

1. **Breaking Changes**: All changes should be backward compatible
2. **Performance Impact**: Rate limiting and logging should have minimal overhead
3. **Security**: Follow OWASP guidelines for all security implementations

---

## Notes

- All new code must follow existing patterns
- TSDoc comments required for new public APIs
- Run full test suite before each deployment
