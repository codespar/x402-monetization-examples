// Register one MCP server with two priced tools: a cheap one and one priced
// above a typical per-tx cap, on purpose, to set up a budget-burn-down demo.
//
// Mirrors mcp-server/README.md's POST /v1/mcp-servers exactly, plus the two
// tool prices this use case needs.
//
//   CODESPAR_API_KEY=csk_test_... \
//   UPSTREAM_MCP_URL=https://mcp.yourservice.com \
//   CONSUMER_ID=your_consumer_id \
//     node seller.mjs
//
// UPSTREAM_MCP_URL must be your own upstream MCP server, exposing a
// `summarize` and a `deep-analysis` tool. This repo doesn't ship one.

const API = process.env.CODESPAR_API_BASE ?? "https://api.codespar.dev";
const KEY = process.env.CODESPAR_API_KEY;
const UPSTREAM = process.env.UPSTREAM_MCP_URL;
const CONSUMER_ID = process.env.CONSUMER_ID;
const SLUG = process.env.MCP_SLUG ?? "agent-budget-mcp";

if (!KEY) {
  console.error("Set CODESPAR_API_KEY (csk_test_... for Base Sepolia, csk_live_... for mainnet).");
  process.exit(1);
}
if (!UPSTREAM) {
  console.error("Set UPSTREAM_MCP_URL to your own upstream MCP server (must expose `summarize` and `deep-analysis`).");
  process.exit(1);
}
if (!CONSUMER_ID) {
  console.error("Set CONSUMER_ID, the consumer that receives the USDC (see api-paywall/README.md for payto/consumer_id).");
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

const body = {
  slug: SLUG,
  name: "Agent budget burn-down MCP",
  upstream_url: UPSTREAM,
  consumer_id: CONSUMER_ID,
  tools: [
    { tool_name: "summarize", price: "0.05", description: "Cheap tool: short summary of the input" },
    { tool_name: "deep-analysis", price: "1.50", description: "Expensive tool: priced above a $1.00 per-tx cap on purpose" },
  ],
};

// Optional: forward auth to your upstream. Stored server-side, never exposed
// to the calling agent.
if (process.env.UPSTREAM_AUTH_HEADER && process.env.UPSTREAM_AUTH_VALUE) {
  body.upstream_auth = {
    header: process.env.UPSTREAM_AUTH_HEADER,
    value: process.env.UPSTREAM_AUTH_VALUE,
  };
}

console.log(`Registering "${SLUG}" (summarize $0.05, deep-analysis $1.50) in front of ${UPSTREAM} ...`);
const res = await authed("/v1/mcp-servers", { method: "POST", body: JSON.stringify(body) });
if (!res.ok) {
  console.error(`create failed: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}
const server = await res.json();
const gatewayUrl = server.gateway_url ?? `https://gw.codespar.dev/mcp/${SLUG}`;
console.log(`live at ${gatewayUrl}`);
console.log(`\nNext: point buyer.mjs at it once you have a mandate -> see README.md step 2.`);
