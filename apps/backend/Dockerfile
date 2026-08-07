# Build context is the repo root (npm workspaces hoist shared deps to the
# root node_modules), so this Dockerfile is referenced from there:
#   docker build -f apps/backend/Dockerfile .
#
# Debian slim, not alpine: the local embeddings provider (onnxruntime-node)
# ships prebuilt glibc binaries and fails to dlopen on musl.

FROM node:22-slim AS base
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci

FROM base AS dev
COPY . .
EXPOSE 3001
CMD ["npm", "run", "start:dev", "-w", "backend"]

FROM base AS build
COPY . .
RUN npm run build -w backend

FROM node:22-slim AS production
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci --omit=dev
COPY --from=build /app/apps/backend/dist apps/backend/dist
EXPOSE 3001
CMD ["node", "apps/backend/dist/main"]
