# x402-fetch-mcp

MCP server that enables AI agents to pay for content automatically using the x402 payment protocol.

## Quick Start (Claude Code)

```bash
# 1. Set your private key
export PRIVATE_KEY="0x..."

# 2. Add the MCP server
claude mcp add x402 -- npx -y x402-fetch-mcp
```

That's it! Claude can now pay for x402-protected content automatically.

## Claude Desktop Setup

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "x402": {
      "command": "npx",
      "args": ["-y", "x402-fetch-mcp"],
      "env": {
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

Config file location:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PRIVATE_KEY` | Yes | - | Wallet private key (starts with `0x`) |
| `NETWORK` | No | `baseSepolia` | Network to use (`base` or `baseSepolia`) |
| `MAX_PAYMENT_USDC` | No | `1000000` | Max payment per request (in USDC units, 1 USDC = 1000000) |

## Available Tools

### `x402_fetch`

Fetch content from a URL with automatic x402 payment handling.

```
Arguments:
- url (required): The URL to fetch
- method (optional): HTTP method (GET, POST, etc.)
- headers (optional): HTTP headers object
- body (optional): Request body for POST/PUT requests
```

### `x402_wallet_info`

Get information about the configured payment wallet (address, network).

## Usage Example

Ask Claude:
> "Fetch the content from learn402.xyz/demo/protected-content"

Claude will automatically:
1. Request the URL
2. Detect the 402 Payment Required response
3. Pay with USDC on Base network
4. Return the content

## Getting Test USDC

1. Create a test wallet or use an existing one
2. Get test USDC from [Circle Faucet](https://faucet.circle.com/)
   - Select **Base Sepolia** network
   - Enter your wallet address
   - Request USDC

## Security

⚠️ **Important security considerations:**

- Use a **dedicated test wallet** for AI agent payments
- Never use your main wallet's private key
- Set `MAX_PAYMENT_USDC` to limit per-request spending
- The private key is stored locally and only used by the MCP server

## How It Works

This MCP server wraps the standard `fetch` API with x402 payment handling:

1. When a request returns HTTP 402 (Payment Required)
2. The server reads the payment details from the response headers
3. Signs and submits a USDC payment transaction
4. Retries the request with the payment proof
5. Returns the unlocked content to Claude

## Network Support

- **Base Sepolia** (testnet): Default, use for testing
- **Base** (mainnet): Set `NETWORK=base` for real payments

## Troubleshooting

### "PRIVATE_KEY environment variable is required"
Make sure you've set the `PRIVATE_KEY` environment variable with your wallet's private key.

### "Insufficient USDC balance"
Get test USDC from [Circle Faucet](https://faucet.circle.com/).

### Payment not going through
- Check your wallet has enough USDC for the payment + gas fees
- Verify you're on the correct network (Base Sepolia for testnet)

## Links

- [x402 Protocol](https://github.com/coinbase/x402)
- [Try the Demo](https://learn402.xyz/demo)
- [MCP Protocol](https://modelcontextprotocol.io)

## License

MIT
