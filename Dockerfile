# Frontend build stage
FROM node:24-alpine AS frontend-builder

RUN --mount=type=cache,target=/var/cache/apk apk add pnpm
WORKDIR /app/webui

# Copy frontend package files
COPY webui/package.json webui/pnpm-lock.yaml webui/pnpm-workspace.yaml ./

# Install frontend dependencies with cache
RUN --mount=type=cache,target=/pnpm_cache \
    pnpm config set store-dir /pnpm_cache && \
    pnpm install --frozen-lockfile

# Copy frontend source code
COPY webui/ ./

# Build frontend
RUN pnpm build

# Backend build stage
FROM golang:1.25-alpine AS backend-builder

# Install build dependencies for Go
RUN --mount=type=cache,target=/var/cache/apk apk add \
    git \
    gcc \
    pkgconfig \
    vips-dev \
    musl-dev

WORKDIR /app

# Copy Go module files
COPY go.mod go.sum ./

# Download Go dependencies with cache
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Copy backend source code
COPY . .

# Copy built frontend assets from frontend-builder
COPY --from=frontend-builder /app/webui/dist ./webui/dist

# Build backend binary (without upx compression)
RUN --mount=type=cache,target=/go/pkg/mod \
    CGO_ENABLED=1 GOOS=linux go build -ldflags "-s -w" -o momoka .

# Runtime stage
FROM alpine:3.22.1

# Install runtime dependencies
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache ca-certificates tzdata wget vips

# Create app user and data directory
RUN addgroup -g 1000 momoka && \
    adduser -D -s /bin/sh -u 1000 -G momoka momoka && \
    mkdir -p /app /data && \
    chown -R momoka:momoka /app /data

WORKDIR /app

# Copy the built binary from backend build stage
COPY --from=backend-builder /app/momoka .
RUN chown momoka:momoka momoka

# Switch to non-root user
USER momoka

# Set environment variables with defaults
ENV MOMOKA_DATA_PATH=/data
ENV MOMOKA_LISTEN=:8080

# Data volume and port
VOLUME ["/data"]
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the application
CMD ["./momoka"]