# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24.16.0-alpine3.23

FROM ${NODE_IMAGE} AS deps
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional --no-audit --no-fund --ignore-scripts

FROM ${NODE_IMAGE} AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PORT=3000

RUN addgroup -S nodejs \
  && adduser -S nextjs -G nodejs \
  && apk add --no-cache su-exec \
  && mkdir -p /app/.data \
  && chown -R nextjs:nodejs /app/.data

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --chown=root:root scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh \
  && rm -rf node_modules/@img node_modules/sharp

ENTRYPOINT ["/app/docker-entrypoint.sh"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "const port=process.env.PORT||3000; fetch(\"http://127.0.0.1:\"+port).then((res)=>process.exit(res.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]

FROM ${NODE_IMAGE} AS worker
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN addgroup -S nodejs \
  && adduser -S nextjs -G nodejs \
  && apk add --no-cache su-exec \
  && mkdir -p /app/.data \
  && chown -R nextjs:nodejs /app/.data

COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nextjs:nodejs /app/package.json ./package.json
COPY --chown=nextjs:nodejs scripts ./scripts
COPY --chown=root:root scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]

CMD ["node", "scripts/proposal-archive-worker.mjs"]
