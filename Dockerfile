# Bnos Menachem Portal — single-server image. Data (CSV files + encrypted uploads) lives in /app/data,
# which docker-compose mounts from the host so it survives upgrades.
FROM node:22-alpine AS base
# One fixed user for both the runtime and the admin tools, so files either one writes (mode 0600)
# stay readable by the other. The entrypoint fixes ownership of the mounted data folder at start.
RUN apk add --no-cache su-exec \
  && addgroup -S -g 1001 portal && adduser -S -u 1001 -G portal -h /home/portal portal
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

# Admin tools (create-admin, seed): docker compose run --rm tools npm run create-admin -- "Name" email
FROM deps AS tools
COPY --chown=portal:portal . .
ENV NODE_ENV=production DATA_DIR=/app/data HOME=/home/portal
CMD ["npm", "run", "create-admin"]

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 DATA_DIR=/app/data
RUN mkdir -p /app/data && chown portal:portal /app/data
COPY --from=build --chown=portal:portal /app/.next/standalone ./
COPY --from=build --chown=portal:portal /app/.next/static ./.next/static
COPY --from=build --chown=portal:portal /app/public ./public
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "server.js"]
