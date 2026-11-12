# syntax=docker/dockerfile:1

# The app has zero npm dependencies: it runs on Node's built-in http server and
# built-in SQLite driver (node:sqlite), so the image only needs the source files.
FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning \
    PORT=3000 \
    DATA_DIR=/app/data

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY src ./src
COPY public ./public

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
