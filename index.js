#!/usr/bin/env node

// Handle subcommands (setup, info) before loading MCP dependencies
const command = process.argv[2];
if (command === 'setup' || command === 'info') {
  import('./setup.js');
} else {
  startMcpServer();
}

async function startMcpServer() {
  const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { CallToolRequestSchema, ListToolsRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');
  const { readFileSync, existsSync } = await import('fs');
  const { join } = await import('path');
  const { homedir } = await import('os');
  const { createWalletClient, http } = await import('viem');
  const { privateKeyToAccount } = await import('viem/accounts');
  const { baseSepolia, base } = await import('viem/chains');
  const { wrapFetchWithPayment, x402Client } = await import('@x402/fetch');
  const { ExactEvmScheme } = await import('@x402/evm');

  const CONFIG_PATH = join(homedir(), '.x402', 'config.json');

  function getConfig() {
    // Priority 1: Config file (~/.x402/config.json)
    if (existsSync(CONFIG_PATH)) {
      try {
        const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
        if (config.privateKey) {
          return {
            privateKey: config.privateKey,
            network: config.network || 'baseSepolia'
          };
        }
      } catch (error) {
        console.error('Warning: Failed to read config file:', error.message);
      }
    }

    // Priority 2: Environment variables (fallback for backward compatibility)
    if (process.env.PRIVATE_KEY) {
      return {
        privateKey: process.env.PRIVATE_KEY,
        network: process.env.NETWORK || 'baseSepolia'
      };
    }

    console.error('No config found. Run "npx x402-fetch-mcp setup" first, or set PRIVATE_KEY environment variable.');
    process.exit(1);
  }

  const config = getConfig();
  const PRIVATE_KEY = config.privateKey;
  const NETWORK = config.network;

  // Network configurations (v2 uses CAIP-2 format)
  const NETWORK_CONFIG = {
    baseSepolia: {
      chain: baseSepolia,
      chainId: 84532,
      caip2: 'eip155:84532',
      usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
    },
    base: {
      chain: base,
      chainId: 8453,
      caip2: 'eip155:8453',
      usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    }
  };

  const networkConfig = NETWORK_CONFIG[NETWORK];
  if (!networkConfig) {
    console.error(`Invalid network: ${NETWORK}. Must be "baseSepolia" or "base".`);
    process.exit(1);
  }

  // Create account and wallet client from private key
  const account = privateKeyToAccount(PRIVATE_KEY);
  const walletClient = createWalletClient({
    account,
    chain: networkConfig.chain,
    transport: http(),
  });

  // Create x402 client with EVM scheme (v2)
  const evmSigner = {
    ...walletClient,
    address: account.address,
  };
  const evmScheme = new ExactEvmScheme(evmSigner);

  const client = x402Client.fromConfig({
    schemes: [
      { network: networkConfig.caip2, client: evmScheme, x402Version: 2 },
    ],
  });

  // Create x402-wrapped fetch
  const x402Fetch = wrapFetchWithPayment(fetch, client);

  // Create MCP server
  const server = new Server(
    {
      name: 'x402-fetch-mcp',
      version: '1.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'x402_fetch',
          description: `Fetches content from a URL with automatic x402 payment support.
This tool can access paywalled content by automatically paying the required amount using the configured wallet.
Network: ${NETWORK} | Wallet: ${account.address}`,
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to fetch content from'
              },
              method: {
                type: 'string',
                description: 'HTTP method (GET, POST, etc.)',
                default: 'GET'
              },
              headers: {
                type: 'object',
                description: 'Additional headers to send with the request',
                additionalProperties: { type: 'string' }
              },
              body: {
                type: 'string',
                description: 'Request body for POST/PUT requests'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'x402_wallet_info',
          description: 'Get information about the configured x402 wallet',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      ]
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'x402_fetch') {
      try {
        const { url, method = 'GET', headers = {}, body } = args;

        const fetchOptions = {
          method,
          headers: {
            'User-Agent': 'x402-fetch-mcp/1.1',
            ...headers,
          },
        };

        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
          fetchOptions.body = body;
        }

        const response = await x402Fetch(url, fetchOptions);
        const contentType = response.headers.get('content-type') || '';

        let content;
        if (contentType.includes('application/json')) {
          content = JSON.stringify(await response.json(), null, 2);
        } else {
          content = await response.text();
        }

        // Check for payment response header
        const paymentResponse = response.headers.get('X-PAYMENT-RESPONSE');
        let paymentInfo = '';
        if (paymentResponse) {
          try {
            const decoded = JSON.parse(atob(paymentResponse));
            paymentInfo = `\n\nPayment Details: ${JSON.stringify(decoded, null, 2)}`;
          } catch (e) {
            // Ignore decode errors
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `Status: ${response.status} ${response.statusText}${paymentInfo}\n\n${content}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }

    if (name === 'x402_wallet_info') {
      return {
        content: [
          {
            type: 'text',
            text: `x402 Wallet Information:
- Address: ${account.address}
- Network: ${NETWORK}
- Chain ID: ${networkConfig.chainId}
- CAIP-2: ${networkConfig.caip2}
- USDC Contract: ${networkConfig.usdcAddress}`
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Unknown tool: ${name}`
        }
      ],
      isError: true
    };
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`x402-fetch-mcp started (Network: ${NETWORK}, Wallet: ${account.address})`);
}
