FROM node:20-alpine

# docker CLI so the bridge can invoke pdflatex via Docker socket
RUN apk add --no-cache docker-cli poppler-utils

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY dist/ ./dist/

EXPOSE 3002

CMD ["node", "dist/bridge/server.js"]
