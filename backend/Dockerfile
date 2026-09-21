# ==============================================================================
# Wello Backend Dockerfile — Multi-Stage Production Image (Nitro Engine)
# ==============================================================================

# --- Stage 1: Build & Dependencies ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools if needed
RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci

COPY . .

# Run Nitro Production Build
RUN npm run build

# --- Stage 2: Production Lightweight Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Add non-root system user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 wello

# Copy built server output and migrations
COPY --from=builder --chown=wello:nodejs /app/.output ./.output
COPY --from=builder --chown=wello:nodejs /app/database ./database
COPY --from=builder --chown=wello:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=wello:nodejs /app/package.json ./package.json

# Create uploads directory with correct permissions
RUN mkdir -p /app/uploads && chown -R wello:nodejs /app/uploads

USER wello

EXPOSE 3001

# Liveness health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/api/health || exit 1

CMD ["node", ".output/server/index.mjs"]
