# Solana Program Deployer Service

A production-ready Node.js/Express API service that automatically deploys Anchor-based Solana programs from GitHub repositories to either devnet or mainnet-beta networks.

## Features

- 🚀 **Automated Deployment**: Deploy Anchor programs from GitHub repositories
- 🔧 **Environment Management**: Automatic installation of Rust, Solana CLI, and Anchor CLI
- 💰 **Wallet Management**: Automatic wallet generation and funding (devnet)
- 🛡️ **Security**: Input validation, rate limiting, and secure keypair handling
- 📊 **Monitoring**: Comprehensive logging and error tracking
- 🐳 **Docker Support**: Containerized deployment with Docker
- ⚡ **Performance**: Concurrent deployment support with resource management

## Quick Start

### Prerequisites

- Node.js 18+ 
- Git
- Basic system dependencies (build-essential, pkg-config, etc.)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd solana-service
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

4. **Start the service**
   ```bash
   npm start
   ```

The service will automatically install required tools (Rust, Solana CLI, Anchor CLI) on first use.

## API Usage

### Deploy a Program

**POST** `/deploy`

Deploy a Solana program from a GitHub repository.

```bash
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "repo_url": "https://github.com/user/anchor-program",
    "network": "devnet"
  }'
```

**Request Body:**
```json
{
  "repo_url": "https://github.com/user/anchor-program",
  "network": "devnet"  // or "mainnet-beta"
}
```

**Success Response:**
```json
{
  "success": true,
  "deployment_id": "123e4567-e89b-12d3-a456-426614174000",
  "data": {
    "program_id": "9nfdasfj2kX6YhQwkN4nYoq1u7eYUMyYtMf4fJAYbhV7",
    "signature": "5gP3Y5i7j82NdMW1LoFZSKHprQxDLQ6L2f6E8f5epREvWzA...",
    "network": "devnet",
    "wallet_address": "7xKXemYFGzYwXPABcYhQ4nYoq1u7eYUMyYtMf4fJAYbhV",
    "deployment_time": "2024-01-01T12:00:00Z",
    "build_duration_ms": 45000,
    "deploy_duration_ms": 12000,
    "total_duration_ms": 57000,
    "verified": true,
    "build_logs": ["..."],
    "deploy_logs": ["..."]
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "BUILD_FAILED",
    "message": "Failed to build Anchor program",
    "details": "Error: Unable to compile program: missing dependency 'spl-token'",
    "logs": ["...build logs..."],
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### Health Check

**GET** `/deploy/health`

Check service health status.

```bash
curl http://localhost:3000/deploy/health
```

### Service Information

**GET** `/`

Get service information and available endpoints.

```bash
curl http://localhost:3000/
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Environment mode |
| `RATE_LIMIT_PER_IP` | 10 | Requests per IP per window |
| `RATE_LIMIT_WINDOW_MS` | 900000 | Rate limit window (15 min) |
| `MAX_CONCURRENT_DEPLOYMENTS` | 5 | Max concurrent deployments |
| `DEPLOYMENT_TIMEOUT_MS` | 600000 | Deployment timeout (10 min) |
| `BUILD_TIMEOUT_MS` | 300000 | Build timeout (5 min) |
| `TEMP_DIR_PATH` | ./temp | Temporary files directory |
| `LOG_DIR_PATH` | ./logs | Log files directory |
| `SOLANA_CLI_PATH` | solana | Solana CLI command |
| `ANCHOR_CLI_PATH` | anchor | Anchor CLI command |
| `MIN_SOL_BALANCE` | 2.0 | Minimum SOL balance required |
| `AIRDROP_AMOUNT` | 2.0 | SOL amount for devnet airdrop |
| `MAX_REPO_SIZE_MB` | 500 | Maximum repository size |

### Networks

- **devnet**: Test network with free airdrops
- **mainnet-beta**: Production network (requires funded wallet)

## Docker Deployment

### Using Docker Compose

1. **Create docker-compose.yml**
   ```yaml
   version: '3.8'
   services:
     solana-deployer:
       build: .
       ports:
         - "3000:3000"
       environment:
         - NODE_ENV=production
         - PORT=3000
       volumes:
         - ./logs:/app/logs
         - ./temp:/app/temp
   ```

2. **Start the service**
   ```bash
   docker-compose up -d
   ```

### Using Docker

1. **Build the image**
   ```bash
   docker build -t solana-deployer .
   ```

2. **Run the container**
   ```bash
   docker run -p 3000:3000 solana-deployer
   ```

## Development

### Running in Development Mode

```bash
npm run dev
```

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Architecture

### Core Components

1. **Environment Setup**: Verifies and installs prerequisites
2. **Project Manager**: Handles repository cloning and validation
3. **Wallet Manager**: Manages Solana wallet operations
4. **Solana CLI Wrapper**: Wraps Solana CLI commands
5. **Anchor Deployer**: Core deployment functionality
6. **Error Handler**: Comprehensive error management

### Deployment Flow

1. **Clone Repository**: Download GitHub repository
2. **Validate Project**: Ensure it's an Anchor project
3. **Configure Network**: Set Solana cluster configuration
4. **Setup Wallet**: Generate and fund deployment wallet
5. **Build Program**: Compile Anchor program
6. **Deploy Program**: Deploy to target network
7. **Cleanup**: Remove temporary files and wallets

## Security Considerations

- **Input Validation**: All inputs are validated and sanitized
- **Rate Limiting**: Prevents abuse with configurable limits
- **Wallet Security**: Unique wallets per deployment, secure keypair handling
- **Resource Limits**: Maximum repository size and deployment timeouts
- **Error Handling**: Secure error messages without sensitive information

## Monitoring

### Logs

Logs are written to the `logs/` directory:
- `combined.log`: All logs
- `error.log`: Error logs only

### Health Checks

The service provides health check endpoints for monitoring:
- Service status
- Environment information
- Deployment statistics

## Troubleshooting

### Common Issues

1. **Missing Dependencies**
   - Ensure system dependencies are installed
   - Check Rust, Solana CLI, and Anchor CLI installation

2. **Build Failures**
   - Verify the repository contains a valid Anchor project
   - Check for missing dependencies in the program

3. **Deployment Failures**
   - Ensure sufficient SOL balance for mainnet
   - Check network connectivity
   - Verify program compatibility

4. **Timeout Issues**
   - Increase timeout values in configuration
   - Check system resources

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the logs in `logs/` directory
- Review the troubleshooting section
- Open an issue on GitHub

## Example Programs

The service works with any Anchor-based Solana program. Example repositories:

- [Anchor Counter Program](https://github.com/coral-xyz/anchor/tree/master/examples/tutorial/basic-0)
- [Anchor Token Program](https://github.com/coral-xyz/anchor/tree/master/examples/tutorial/basic-1)
- [Anchor Pyth Program](https://github.com/coral-xyz/anchor/tree/master/examples/pyth)

Make sure your repository contains:
- `Anchor.toml` configuration file
- `programs/` directory with Rust programs
- Valid Cargo.toml files
