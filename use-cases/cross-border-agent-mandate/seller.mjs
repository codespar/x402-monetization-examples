// Seller side of the cross-border agent mandate example: two independent
// sellers, priced independently, no FX between them.
//
//   [1] POST /v1/mcp-servers/validate  discover tools on the upstream MCP server
//   [2] POST /v1/mcp-servers           register + price a "translate" tool at 0.03 USDC
//   [3] POST /v1/payment-links         create a Pix-only link for a R$35.00 report
//
// This only creates the two payees. Pay them with buyer.mjs (the governed
// CodeSpar CLI mandate) once this script prints their gateway URLs.
//
//   cp .env.example .env   # fill in CODESPAR_API_KEY, CODESPAR_CONSUMER_ID, UPSTREAM_MCP_URL
//   npm install
//   npm run seller

import { readFileSync } from "node:fs";

// Minimal .env loader (no dependency). Real environment variables win.
try {
  for (const line of readFileSync(new URL("./.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const API = process.env.CODESPAR_API_BASE ?? "https://api.codespar.dev";
const KEY = process.env.CODESPAR_API_KEY;
const CONSUMER_ID = process.env.CODESPAR_CONSUMER_ID;
const UPSTREAM_MCP_URL = process.env.UPSTREAM_MCP_URL;
const SELLER_PIX_KEY = process.env.SELLER_PIX_KEY ?? "seller@pix.br";

if (!KEY) {
  console.error("Set CODESPAR_API_KEY. Get one at https://codespar.dev");
  process.exit(1);
}
if (!CONSUMER_ID) {
  console.error("Set CODESPAR_CONSUMER_ID, the provisioned wallet that receives the USDC leg.");
  process.exit(1);
}
if (!UPSTREAM_MCP_URL) {
  console.error("Set UPSTREAM_MCP_URL to the MCP server that actually implements the 'translate' tool.");
  process.exit(1);
}

const authed = (path, init = {}) =>
  fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

console.log(`\n[1/3] Discovering tools on ${UPSTREAM_MCP_URL} ...`);
const validateRes = await authed("/v1/mcp-servers/validate", {
  method: "POST",
  body: JSON.stringify({ upstream_url: UPSTREAM_MCP_URL }),
});
if (!validateRes.ok) {
  console.error(`  validate failed: HTTP ${validateRes.status} ${await validateRes.text()}`);
  process.exit(1);
}
console.log(`  upstream reachable: ${JSON.stringify(await validateRes.json())}`);

console.log(`\n[2/3] Registering "translate" at 0.03 USDC ...`);
const mcpRes = await authed("/v1/mcp-servers", {
  method: "POST",
  body: JSON.stringify({
    slug: "translate-mcp",
    name: "Translate MCP",
    upstream_url: UPSTREAM_MCP_URL,
    consumer_id: CONSUMER_ID,
    tools: [
      { tool_name: "translate", price: "0.03", description: "Translate text between languages" },
    ],
  }),
});
if (!mcpRes.ok) {
  console.error(`  register failed: HTTP ${mcpRes.status} ${await mcpRes.text()}`);
  process.exit(1);
}
const mcpServer = await mcpRes.json();
const mcpGatewayUrl = mcpServer.gateway_url ?? "https://gw.codespar.dev/mcp/translate-mcp";
console.log(`  live at ${mcpGatewayUrl}`);

console.log(`\n[3/3] Creating a Pix-only payment link for R$35.00 ...`);
const linkRes = await authed("/v1/payment-links", {
  method: "POST",
  body: JSON.stringify({
    title: "Report translation (PT-BR)",
    accepts: [{ rail: "pix", amount: "35.00", pix: { key: SELLER_PIX_KEY } }],
    one_time: true,
    max_uses: 1,
  }),
});
if (!linkRes.ok) {
  console.error(`  create failed: HTTP ${linkRes.status} ${await linkRes.text()}`);
  process.exit(1);
}
const link = await linkRes.json();
const linkGatewayUrl = link.gateway_url ?? (link.slug ? `https://gw.codespar.dev/pay/${link.slug}` : null);
if (!linkGatewayUrl) {
  console.error(`  created, but couldn't find the gateway URL in the response: ${JSON.stringify(link)}`);
  process.exit(1);
}
console.log(`  live at ${linkGatewayUrl}`);

console.log(`\nDone. Two payees, two currencies, no FX:`);
console.log(`  USDC leg  ${mcpGatewayUrl}`);
console.log(`  Pix leg   ${linkGatewayUrl}`);
console.log(`\nPay both under one mandate:`);
console.log(`  MCP_GATEWAY_URL=${mcpGatewayUrl} \\`);
console.log(`  PAYMENT_LINK_URL=${linkGatewayUrl} \\`);
console.log(`  npm run buyer`);
