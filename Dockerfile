# Production image for the Smart University ecosystem.
#
# The app needs three things that a normal Node image does not provide, so this
# image wires them together:
#   1. LibreOffice, to convert uploaded PPT/DOC/XLS files into PDF previews
#   2. A persistent directory for the SQLite database and uploaded files. Mount
#      a volume at /app/data and it is stored in the cloud for every user.
#   3. The prisma CLI + tsx (devDependencies), used at boot to apply migrations
#      and seed demo accounts on a fresh database.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- Stage 1: install dependencies ------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: generate client and build -------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The build stage needs a reachable database for any build-time queries, so a
# schema-only database is created before `next build` runs. The runtime stage
# uses its own volume-backed database instead.
ARG DATABASE_URL=file:/app/dev.db
ENV DATABASE_URL=$DATABASE_URL
RUN npx prisma generate && npx prisma migrate deploy && npm run build

# --- Stage 3: runtime --------------------------------------------------------
FROM base AS runner
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      libreoffice-core \
      libreoffice-writer \
      libreoffice-calc \
      libreoffice-impress \
      fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production PORT=3000
ENV DATABASE_URL=file:/app/data/dev.db
ENV UPLOADS_DIR=/app/data/uploads

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY entrypoint.sh /app/entrypoint.sh

RUN sed -i 's/\r$//' /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh && \
    mkdir -p /app/data/uploads && \
    chmod 775 /app/data/uploads

# Anything mounted here survives restarts and redeploys.
VOLUME /app/data
EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]