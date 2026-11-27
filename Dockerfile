# Bnos Menachem Portal — single-server image. Data (CSV files + encrypted uploads) lives in /app/data,
# which docker-compose mounts from the host so it survives upgrades.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

# Admin tools (create-admin, seed): docker compose run --rm tools npm run create-admin -- "Name" email
FROM deps AS tools
COPY . .
ENV NODE_ENV=production
CMD ["npm", "run", "create-admin"]

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 DATA_DIR=/app/data
RUN addgroup -S portal && adduser -S portal -G portal && mkdir -p /app/data && chown portal:portal /app/data
COPY --from=build --chown=portal:portal /app/.next/standalone ./
COPY --from=build --chown=portal:portal /app/.next/static ./.next/static
COPY --from=build --chown=portal:portal /app/public ./public
USER portal
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "server.js"]
