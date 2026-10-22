FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Prevent Puppeteer from downloading heavy Chromium binaries during build
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true

# Install production dependencies and clean cache in a single layer to save disk space
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force \
    && rm -rf /root/.npm /tmp/*

# Production runtime stage
FROM node:22-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true

# Copy production node_modules from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY package*.json ./

# Copy application code
COPY . .

# Expose port
EXPOSE 4000

# Start command using index.js
CMD ["node", "index.js"]
