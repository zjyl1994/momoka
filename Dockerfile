# Build stage
FROM node:24-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    go \
    make \
    upx \
    git

# Set Go environment
ENV GOPATH=/go
ENV PATH=$GOPATH/bin:/usr/local/go/bin:$PATH

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code
COPY . .

# Build using Makefile
RUN make all

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata wget

# Create app user and data directory
RUN addgroup -g 1000 momoka && \
    adduser -D -s /bin/sh -u 1000 -G momoka momoka && \
    mkdir -p /app /data && \
    chown -R momoka:momoka /app /data

WORKDIR /app

# Copy the built binary from build stage
COPY --from=builder /app/momoka .
RUN chown momoka:momoka momoka

# Set environment variables with defaults
ENV MOMOKA_DATA_PATH=/data
ENV MOMOKA_LISTEN=:8080

# Data volume and port
VOLUME [ "/data" ]
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

# Switch to non-root user
USER momoka

CMD ["./momoka"]