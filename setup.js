#!/usr/bin/env node
import { createInterface } from 'readline';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.x402');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function setup() {
  console.log('x402-fetch-mcp Setup\n');

  // Check existing config
  if (existsSync(CONFIG_PATH)) {
    const overwrite = await question('Config already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Aborted.');
      rl.close();
      process.exit(0);
    }
  }

  const privateKey = await question('Enter your private key (0x...): ');
  const network = await question('Network (baseSepolia/base) [baseSepolia]: ') || 'baseSepolia';

  // Validation
  if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
    console.error('Invalid private key format. Must be 0x followed by 64 hex characters.');
    rl.close();
    process.exit(1);
  }

  if (!['baseSepolia', 'base'].includes(network)) {
    console.error('Invalid network. Must be "baseSepolia" or "base".');
    rl.close();
    process.exit(1);
  }

  // Save config
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_PATH, JSON.stringify({ privateKey, network }, null, 2), { mode: 0o600 });

  console.log(`\n✓ Config saved to ${CONFIG_PATH}`);
  console.log('\nNow add MCP to Claude Code:');
  console.log('  claude mcp add x402 -- npx x402-fetch-mcp');

  rl.close();
}

async function info() {
  if (!existsSync(CONFIG_PATH)) {
    console.log('No config found. Run "npx x402-fetch-mcp setup" first.');
    process.exit(1);
  }

  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    const maskedKey = config.privateKey
      ? `${config.privateKey.slice(0, 6)}...${config.privateKey.slice(-4)}`
      : 'not set';

    console.log('x402-fetch-mcp Config Info\n');
    console.log(`  Config file: ${CONFIG_PATH}`);
    console.log(`  Network: ${config.network || 'baseSepolia'}`);
    console.log(`  Private Key: ${maskedKey}`);
  } catch (error) {
    console.error('Error reading config:', error.message);
    process.exit(1);
  }
}

// Handle subcommand
const command = process.argv[2];

if (command === 'info') {
  info();
} else {
  setup();
}
