import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve MCP server path: env var (absolute or relative to project root) or default sibling folder
const MCP_SERVER_PATH = process.env.MCP_SERVER_PATH
  ? resolve(__dirname, '..', process.env.MCP_SERVER_PATH)
  : resolve(__dirname, '../../sap-wm-mcp/index.js');

let client = null;
let cachedTools = null;

async function connect() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [MCP_SERVER_PATH],
    env: { ...process.env },       // pass full env so sap-wm-mcp finds its own .env via dotenv
    stderr: 'pipe',                // silence MCP server stderr from our console
  });

  const c = new Client({ name: 'wm-assistant', version: '1.0.0' }, { capabilities: {} });
  await c.connect(transport);
  return c;
}

export async function getMcpClient() {
  if (!client) {
    console.error('[mcp] connecting to', MCP_SERVER_PATH);
    client = await connect();
    console.error('[mcp] connected');
  }
  return client;
}

export async function getMcpTools() {
  if (cachedTools) return cachedTools;
  const c = await getMcpClient();
  const { tools } = await c.listTools();
  cachedTools = tools;
  console.error(`[mcp] loaded ${tools.length} tools`);
  return cachedTools;
}

export async function callMcpTool(name, args) {
  const c = await getMcpClient();
  const result = await c.callTool({ name, arguments: args ?? {} });
  // MCP returns { content: [{ type: 'text', text: '...' }] }
  const raw = result.content?.[0]?.text ?? JSON.stringify(result);
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// Gracefully disconnect on process exit
process.on('exit', () => { try { client?.close(); } catch {} });
