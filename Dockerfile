# OHIF Viewer Dockerfile
# Simplified build for OHIF monorepo

# Stage 1: Build
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy everything (OHIF is a complex monorepo)
COPY . .

# Install all dependencies (including Lerna and workspace packages)
RUN yarn install --frozen-lockfile

# Build the viewer
RUN yarn run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built application
COPY --from=builder /app/platform/app/dist /usr/share/nginx/html

# Copy the config directory with orthanc configuration
COPY --from=builder /app/platform/app/public/config /usr/share/nginx/html/config

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf

# Create nginx configuration for SPA
RUN echo 'server { \
    listen 3000; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # SPA routing - redirect all to index.html \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Cache static assets \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["nginx", "-g", "daemon off;"]
