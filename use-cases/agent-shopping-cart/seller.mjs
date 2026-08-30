// Seller side of the agent shopping cart: three independent sellers, three
// resources, one account so the example runs from a single API key.
//
//   [1] POST /v1/paywalls        market-data API, $0.01 USDC/call
//   [2] POST /v1/mcp-servers     analytics MCP, one tool ("screen") at $0.02 USDC/call
//   [3] POST /v1/payment-links   cart-checkout, $15.00 USDC, one_time
//
// This only creates the three payees. Pay them with buyer.mjs (three governed
// CodeSpar CLI mandates) once this script prints their gateway URLs.
//
//   cp .env.example .env   # fill in CODESPAR_API_KEY, CONSUMER_ID
//   npm install
//   npm run seller

import { readFileSync, writeFileSync } from "node:fs";

// Minimal .env loader (no dependency). Real environment variables win.
try {
  for (const line of readFileSync(new URL("./.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const API = process.env.CODESPAR_API_BASE ?? "https://api.codespar.dev";
const KEY = process.env.CODESPAR_API_KEY;
const CONSUMER_ID = process.env.CONSUMER_ID;
const UPSTREAM_API_URL = process.env.UPSTREAM_API_URL ?? "https://api.yourservice.com/quotes";
const UPSTREAM_MCP_URL = process.env.UPSTREAM_MCP_URL ?? "https://mcp.yourservice.com";

if (!KEY) {
  console.error("Set CODESPAR_API_KEY. Get one at https://codespar.dev");
  process.exit(1);
}
if (!CONSUMER_ID) {
  console.error("Set CONSUMER_ID, the provisioned wallet all three resources pay into.");
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

async function create(path, body, label) {
  const res = await authed(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    console.error(`  ${label} failed: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  return res.json();
}

console.log(`\n[1/3] Creating the market-data paywall ($0.01 USDC/call) ...`);
const paywall = await create(
  "/v1/paywalls",
  {
    slug: "market-data",
    name: "Market data API",
    upstream_url: UPSTREAM_API_URL,
    price: "0.01",
    currency: "USDC",
    payto: { kind: "provisioned", consumer_id: CONSUMER_ID },
  },
  "paywall create",
);
const paywallUrl = paywall.gateway_url ?? "https://gw.codespar.dev/market-data";
console.log(`  live at ${paywallUrl}`);

console.log(`\n[2/3] Creating the analytics MCP server, one tool ($0.02 USDC/call) ...`);
// In practice, call POST /v1/mcp-servers/validate against your real upstream
// first, so you price only the tools it actually exposes (see ../../mcp-server).
const mcp = await create(
  "/v1/mcp-servers",
  {
    slug: "analytics-mcp",
    name: "Analytics MCP",
    upstream_url: UPSTREAM_MCP_URL,
    consumer_id: CONSUMER_ID,
    tools: [
      { tool_name: "screen", price: "0.02", description: "Screen a ticker against your model" },
    ],
  },
  "mcp-server create",
);
const mcpUrl = mcp.gateway_url ?? "https://gw.codespar.dev/mcp/analytics-mcp";
console.log(`  live at ${mcpUrl}`);

console.log(`\n[3/3] Creating the cart-checkout payment link ($15.00 USDC, one_time) ...`);
const link = await create(
  "/v1/payment-links",
  {
    title: "Cart checkout",
    accepts: [
      { rail: "x402", amount: "15.00", pay_to: { kind: "provisioned", consumer_id: CONSUMER_ID } },
    ],
    one_time: true,
    max_uses: 1,
  },
  "payment-link create",
);
// Unlike the paywall and the mcp-server above, a payment link carries no
// gateway_url: its URL is `pay_url`, over a slug CodeSpar assigns, so there is
// no fallback to guess here if the field is missing from the response.
// See https://docs.codespar.dev/docs/api/payment-links
const linkUrl = link.pay_url;
if (!linkUrl) {
  console.error(`  created, but couldn't find pay_url in the response: ${JSON.stringify(link)}`);
  process.exit(1);
}
console.log(`  live at ${linkUrl}`);

const cart = { paywall_url: paywallUrl, mcp_url: mcpUrl, payment_link_url: linkUrl };
writeFileSync(new URL("./.cart.json", import.meta.url), JSON.stringify(cart, null, 2));

console.log(`\nDone. Three unrelated sellers, one account:`);
console.log(`  paywall       ${paywallUrl}`);
console.log(`  mcp tool      ${mcpUrl}`);
console.log(`  payment link  ${linkUrl}`);
console.log(`\nWrote .cart.json for buyer.mjs. Pay all three under one wallet:`);
console.log(`  npm install -g @codespar/cli && codespar login   # one time`);
console.log(`  npm run buyer`);
