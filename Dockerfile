# syntax=docker/dockerfile:1

# ---- deps: full dependency tree (dev deps are needed to build and to run migrations)
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the Next.js app
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* variables are inlined into the client bundle at build time,
# so they must be provided as build args, not only at runtime.
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_VAPI_API_KEY
ARG NEXT_PUBLIC_ASSISTANT_ID
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_VAPI_API_KEY=$NEXT_PUBLIC_VAPI_API_KEY \
    NEXT_PUBLIC_ASSISTANT_ID=$NEXT_PUBLIC_ASSISTANT_ID \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- migrator: applies Drizzle migrations (includes CREATE EXTENSION vector)
FROM deps AS migrator
WORKDIR /app
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY database ./database
CMD ["npx", "drizzle-kit", "migrate"]

# ---- runner: production image
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
