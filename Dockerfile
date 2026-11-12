FROM node:22-slim AS build
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod --ignore-scripts && mkdir -p storage

FROM node:22-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    openssl ca-certificates poppler-utils \
    libreoffice-impress libreoffice-writer libreoffice-calc \
    fonts-liberation fonts-dejavu fonts-crosextra-carlito fonts-crosextra-caladea \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "pnpm prisma:deploy && node dist/main.js"]
