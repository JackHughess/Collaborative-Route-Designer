# Hocuspocus collaboration server for Fly.io (or Render).
# Node 24 runs the TypeScript sources directly (type stripping), so there is no
# build step. Secrets come from `fly secrets set`, never from this image.
FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

USER node
EXPOSE 1234
CMD ["node", "src/index.ts"]
