# Self-hosted QuizMaster. Profiles are kept on a mounted volume, so there is
# no storage service and no quota to run into.

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Also copies the text-recognition engine and language data into public/.
ENV BUILD_STANDALONE=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data

RUN addgroup -S app && adduser -S app -G app && mkdir -p /data && chown app:app /data

COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

USER app
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.json()).then(d=>process.exit(d.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
