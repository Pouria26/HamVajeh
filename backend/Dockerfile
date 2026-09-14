# Stage 1: Build TypeScript application
FROM node:20-alpine AS builder

WORKDIR /app

# Configure npm for network resilience
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set maxsockets 3 && \
    npm config set audit false && \
    npm config set fund false

COPY package*.json tsconfig*.json ./
RUN npm ci --no-audit || npm install --no-audit

COPY src/ ./src/
RUN npm run build

# Prune devDependencies to keep only production dependencies
RUN npm prune --omit=dev && npm cache clean --force

# Stage 2: Minimal Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

COPY package*.json ./
# Copy production node_modules and compiled output from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Use standard non-root node user for security
USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]

