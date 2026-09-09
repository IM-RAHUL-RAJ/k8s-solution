FROM node:20-alpine

WORKDIR /app

COPY services/auth-stub/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY services/auth-stub/server.js ./

ENV PORT=3000
EXPOSE 3000
USER node

CMD ["npm", "start"]
