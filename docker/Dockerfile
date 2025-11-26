# Rox Backend Dockerfile
# Multi-stage build for optimized production image

# ============================================
# Stage 1: Build
# ============================================
FROM oven/bun:1.1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY packages/backend ./packages/backend
COPY packages/shared ./packages/shared
COPY tsconfig.json ./

# Build shared package
WORKDIR /app/packages/shared
RUN bun run build

# Build backend
WORKDIR /app/packages/backend
RUN bun run build

# ============================================
# Stage 2: Production
# ============================================
FROM oven/bun:1.1-alpine AS production

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S rox && \
    adduser -S -D -H -u 1001 -s /sbin/nologin -G rox rox

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/package.json ./packages/backend/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/package.json ./

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && chown -R rox:rox /app

# Switch to non-root user
USER rox

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    DB_TYPE=postgres

# Run the application
CMD ["bun", "run", "packages/backend/dist/index.js"]
