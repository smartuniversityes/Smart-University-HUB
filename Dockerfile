# ---------- Build stage ----------
FROM node:20-slim AS builder

WORKDIR /app

# Install Python and build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ---------- Production stage ----------
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install LibreOffice for document conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-core \
    libreoffice-writer \
    libreoffice-impress \
    libreoffice-calc \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r nextjs && useradd -r -g nextjs nextjs

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /App/tsconfig.json ./tsconfig.json
COPY --from=builder /App/postcss.config.mjs ./postcss.config.mjs

# Create uploads directory with correct permissions
RUN mkdir -p /app/uploads/originals /app/uploads/previews /app/uploads/tmp /app/uploads/lo-profiles \
    && chown -R nextjs:nextjs /app/uploads

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV UPLOADS_DIR=/app/uploads

CMD ["npm", "start"]
