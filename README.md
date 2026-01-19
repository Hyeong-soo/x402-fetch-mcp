# x402-fetch-mcp

MCP (Model Context Protocol) server that enables AI agents to automatically pay for and access paywalled content using the x402 payment protocol.

## What is x402?

x402 is a payment protocol that uses HTTP status code 402 (Payment Required) to enable micropayments for web content. When an AI agent encounters a 402 response, this MCP server automatically handles the payment using USDC on Base network.

## Features

- **Automatic Payments**: Seamlessly handles 402 Payment Required responses
- **Secure Key Storage**: Private keys stored in `~/.x402/config.json` (not environment variables)
- **Base Network Support**: Works with Base Sepolia (testnet) and Base (mainnet)
- **Claude Code Integration**: Works directly with Claude Code via MCP

## Quick Start

### 1. Install and Setup

```bash
# Run the setup wizard
npx x402-fetch-mcp setup
```

You'll be prompted for:
- **Private Key**: Your wallet's private key (0x... format)
- **Network**: `baseSepolia` (testnet) or `base` (mainnet)

### 2. Add to Claude Code

```bash
claude mcp add x402 -- npx x402-fetch-mcp
```

### 3. Verify Installation

```bash
claude mcp list
# Should show: x402 - ✓ Connected
```

## Usage

Once installed, Claude Code can automatically access paywalled content:

```
User: Fetch the content from https://learn402.xyz/demo/protected-content

Claude: I'll use the x402_fetch tool to access this paywalled content...
[Automatically pays $0.01 USDC and retrieves content]
```

## Available Tools

### x402_fetch

Fetches content from a URL with automatic x402 payment support.

**Parameters:**
- `url` (required): The URL to fetch
- `method` (optional): HTTP method (GET, POST, etc.)
- `headers` (optional): Additional headers
- `body` (optional): Request body for POST/PUT

### x402_wallet_info

Returns information about the configured wallet.

## Configuration

Config file location: `~/.x402/config.json`

```json
{
  "privateKey": "0x...",
  "network": "baseSepolia"
}
```

### Check Configuration

```bash
npx x402-fetch-mcp-setup info
```

### Update Configuration

```bash
npx x402-fetch-mcp setup
# Choose 'y' to overwrite existing config
```

## Security

- Private keys are stored in `~/.x402/config.json` with `600` permissions
- Keys are NOT stored in environment variables (prevents exposure via `env` command)
- Never share your config file or commit it to version control

## Network Support

| Network | Chain ID | USDC Contract |
|---------|----------|---------------|
| Base Sepolia | 84532 | 0x036CbD53842c5426634e7929541eC2318f3dCF7e |
| Base | 8453 | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |

## Getting Test USDC

For Base Sepolia testnet:
1. Get testnet ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
2. Get test USDC from [Circle Faucet](https://faucet.circle.com/)

## Demo

Try the x402 payment flow at [learn402.xyz](https://learn402.xyz)

## License

MIT
