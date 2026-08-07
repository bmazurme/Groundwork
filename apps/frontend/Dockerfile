# Build context is the repo root (npm workspaces hoist shared deps to the
# root node_modules), so this Dockerfile is referenced from there:
#   docker build -f apps/frontend/Dockerfile .

FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci

FROM base AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "-w", "frontend"]

FROM base AS build
COPY . .
RUN npm run build -w frontend

FROM nginx:alpine AS production
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
