# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install build tools for native addons like bcrypt
RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build && npm prune --omit=dev

# Stage 2: Production runtime
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

USER node

COPY --chown=node:node package*.json ./
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/main.js"]

