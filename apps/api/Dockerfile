FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@newranews/api

# pnpm deploy creates a standalone directory with production deps (no symlinks)
RUN pnpm --filter @newranews/api deploy --prod /app/deployed

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/deployed/dist ./dist
COPY --from=builder /app/deployed/node_modules ./node_modules
COPY --from=builder /app/deployed/package.json ./package.json

# Regenerate Prisma client for alpine target platform (may differ from builder)
COPY --from=builder /app/packages/database/prisma ./prisma
RUN npx prisma generate --schema=./prisma/schema.prisma

EXPOSE 3001

CMD ["node", "dist/server.js"]
