# ==============================================================================
# Wello Frontend Dockerfile — Multi-Stage Production Image (Nuxt 3 Engine)
# ==============================================================================

# --- Stage 1: Build & Dependencies ---
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci

COPY . .

# Run Nuxt 3 Production Build
RUN npm run build

# --- Stage 2: Production Lightweight Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NITRO_PORT=3000

# Add non-root system user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 wello

# Copy Nuxt output
COPY --from=builder --chown=wello:nodejs /app/.output ./.output
COPY --from=builder --chown=wello:nodejs /app/package.json ./package.json

USER wello

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", ".output/server/index.mjs"]
