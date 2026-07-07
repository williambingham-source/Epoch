FROM node:20-alpine
WORKDIR /app
RUN npm install y-websocket@1
EXPOSE 3004
ENV PORT=3004
CMD ["node", "node_modules/y-websocket/bin/server.js"]
