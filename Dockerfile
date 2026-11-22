# ARADA BETTING — demo platform container
FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    ARADA_DATA_DIR=/app/data

WORKDIR /app

# Refresh OS packages so the final image ships patched Alpine libraries.
RUN echo "os-refresh 2026-11-21" && apk upgrade --no-cache

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY . .

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
