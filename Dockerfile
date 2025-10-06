# Multi-stage Dockerfile for Solana Program Deployer Service

# Stage 1: Build environment
FROM ubuntu:22.04 as builder

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV RUSTUP_HOME=/usr/local/rustup
ENV CARGO_HOME=/usr/local/cargo
ENV PATH=/usr/local/cargo/bin:$PATH

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libudev-dev \
    llvm \
    libclang-dev \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
RUN rustup default stable

# Install Solana CLI
RUN sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Install Anchor CLI directly
RUN cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked --force

# Stage 2: Runtime environment
FROM ubuntu:22.04

# Set environment variables
ENV NODE_ENV=production
ENV DEBIAN_FRONTEND=noninteractive

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

# Copy Rust and Cargo from builder
COPY --from=builder /usr/local/rustup /usr/local/rustup
COPY --from=builder /usr/local/cargo /usr/local/cargo

# Install Solana CLI in runtime stage
RUN sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Set PATH
ENV PATH="/usr/local/cargo/bin:/root/.local/share/solana/install/active_release/bin:$PATH"

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/

# Create environment file if it doesn't exist
RUN echo "PORT=3000\nNODE_ENV=production\nLOG_LEVEL=info" > .env

# Create necessary directories
RUN mkdir -p temp logs

# Create non-root user
RUN useradd -m -u 1000 deployer && \
    chown -R deployer:deployer /app

# Install Solana CLI for the deployer user
RUN su - deployer -c "sh -c \"\$(curl -sSfL https://release.solana.com/stable/install)\""
RUN su - deployer -c "echo 'export PATH=\"\$HOME/.local/share/solana/install/active_release/bin:\$PATH\"' >> ~/.bashrc"

# Switch to non-root user
USER deployer

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/deploy/health || exit 1

# Start the application
CMD ["npm", "start"]
