#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { wrapFetchWithPayment } from "x402-fetch";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";

// Get config from environment
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const NETWORK = process.env.NETWORK || "baseSepolia";

if (!PRIVATE_KEY) {
  console.error("PRIVATE_KEY environment variable is required");
  process.exit(1);
}

// Setup wallet
const chain = NETWORK === "base" ? base : baseSepolia;
const account = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(),
});

// Create x402-enabled fetch
// maxValue: max payment in USDC (1 USDC = 1000000 units)
const maxPaymentUSDC = BigInt(process.env.MAX_PAYMENT_USDC || "1000000"); // default 1 USDC
const x402Fetch = wrapFetchWithPayment(fetch, walletClient, maxPaymentUSDC);

// Create MCP server
const server = new Server(
  {
    name: "x402-fetch-mcp",
    version: "1.0.0",
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
        name: "x402_fetch",
        description:
          "Fetch content from a URL with automatic x402 payment handling. Supports HTTP 402 Payment Required responses and automatically processes USDC payments on Base network.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL to fetch",
            },
            method: {
              type: "string",
              description: "HTTP method (GET, POST, etc.)",
              default: "GET",
            },
            headers: {
              type: "object",
              description: "Optional HTTP headers",
              additionalProperties: { type: "string" },
            },
            body: {
              type: "string",
              description: "Optional request body for POST/PUT requests",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "x402_wallet_info",
        description: "Get information about the configured x402 payment wallet",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "x402_fetch") {
    const { url, method = "GET", headers = {}, body } = args;

    try {
      const fetchOptions = {
        method,
        headers,
      };

      if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
        fetchOptions.body = body;
      }

      console.error(`[x402-fetch] ========================================`);
      console.error(`[x402-fetch] Fetching: ${method} ${url}`);
      console.error(`[x402-fetch] Wallet: ${account.address}`);

      const response = await x402Fetch(url, fetchOptions);
      const contentType = response.headers.get("content-type") || "";

      console.error(`[x402-fetch] Response status: ${response.status} ${response.statusText}`);
      console.error(`[x402-fetch] Content-Type: ${contentType}`);

      let content;
      if (contentType.includes("application/json")) {
        content = JSON.stringify(await response.json(), null, 2);
      } else {
        content = await response.text();
      }

      // Check if payment was made
      const paymentResponse = response.headers.get("x-payment-response");
      const paymentResponseAlt = response.headers.get("payment-response");
      const actualPaymentResponse = paymentResponse || paymentResponseAlt;

      let paymentInfo = null;
      if (actualPaymentResponse) {
        try {
          const decoded = JSON.parse(atob(actualPaymentResponse));
          const amountUsdc = decoded.amount ? (Number(decoded.amount) / 1000000).toFixed(6) : null;
          paymentInfo = {
            txHash: decoded.txHash || null,
            amount: amountUsdc ? `${amountUsdc} USDC` : null,
            amountRaw: decoded.amount || null,
            network: chain.name,
            settled: decoded.settled || false,
          };
          console.error(`[x402-fetch] ✅ PAYMENT MADE!`);
          console.error(`[x402-fetch]    TX Hash: ${paymentInfo.txHash || 'N/A'}`);
          console.error(`[x402-fetch]    Amount: ${paymentInfo.amount || 'N/A'}`);
          console.error(`[x402-fetch]    Network: ${paymentInfo.network}`);
          console.error(`[x402-fetch]    Settled: ${paymentInfo.settled}`);
        } catch (e) {
          console.error(`[x402-fetch] Payment response (raw): ${actualPaymentResponse}`);
        }
      } else {
        console.error(`[x402-fetch] ℹ️ No payment was required or made`);
      }

      console.error(`[x402-fetch] Content length: ${content.length} chars`);
      console.error(`[x402-fetch] ========================================`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              status: response.status,
              statusText: response.statusText,
              paymentMade: !!actualPaymentResponse,
              payment: paymentInfo,
              content: content,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "x402_wallet_info") {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            address: account.address,
            network: NETWORK,
            chain: chain.name,
          }, null, 2),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Unknown tool: ${name}`,
      },
    ],
    isError: true,
  };
});

// Start server
async function main() {
  console.error("[x402-fetch-mcp] Starting server...");
  console.error(`[x402-fetch-mcp] Wallet: ${account.address}`);
  console.error(`[x402-fetch-mcp] Network: ${chain.name}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[x402-fetch-mcp] Server running on stdio");
}

main().catch((error) => {
  console.error("[x402-fetch-mcp] Fatal error:", error);
  process.exit(1);
});
