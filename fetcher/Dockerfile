FROM node:22-bookworm-slim AS deps

WORKDIR /app/fetcher
COPY fetcher/package.json fetcher/package-lock.json ./
RUN npm ci

FROM deps AS build

COPY fetcher/tsconfig.json ./
COPY fetcher/src ./src
COPY convex/_generated ../convex/_generated
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/fetcher

COPY fetcher/package.json fetcher/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/fetcher/dist ./dist
COPY --from=build /app/convex/_generated ../convex/_generated

CMD ["node", "dist/index.js"]
