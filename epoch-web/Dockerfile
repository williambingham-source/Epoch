# Pre-build on host with: npx next build (from epoch-web/)
# Standalone output is nested under epoch-web/ because Next.js detects the parent lock file as the monorepo root.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY .next/standalone ./
COPY .next/static ./epoch-web/.next/static
RUN mkdir -p epoch-web/public
EXPOSE 3003
ENV PORT=3003
ENV HOSTNAME=0.0.0.0
WORKDIR /app/epoch-web
CMD ["node", "server.js"]
