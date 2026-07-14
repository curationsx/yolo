FROM node:22.12.0-bookworm-slim

ENV NODE_ENV=production \
    PORT=8080 \
    HOME=/tmp/curations-home \
    COPILOT_HOME=/tmp/curations-copilot \
    COPILOT_WORKSPACE=/tmp/curations-workspace

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

COPY server.mjs ./

RUN mkdir -p "$HOME" "$COPILOT_HOME" "$COPILOT_WORKSPACE" \
    && chown -R node:node /app "$HOME" "$COPILOT_HOME" "$COPILOT_WORKSPACE"

USER node

EXPOSE 8080

CMD ["node", "server.mjs"]
