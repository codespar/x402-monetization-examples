// Create the api-paywall a recurring mandate will pay every day: one
// ordinary paywall, priced at $0.50, no different in shape from any other
// api-paywall. The recurring part lives entirely on the buyer side
// (buyer.mjs); this script never changes for it.
//
// This is the exact POST /v1/paywalls call from ../../api-paywall/README.md,
// with a different slug, upstream, and price.
//
//   cp .env.example .env   # fill in the three values
//   npm run create
//
// or just:
//   CODESPAR_API_KEY=csk_test_... CODESPAR_CONSUMER_ID=... \
//   UPSTREAM_URL=https://api.yourservice.com/digest node seller.mjs

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
const UPSTREAM = process.env.UPSTREAM_URL ?? "https://api.yourservice.com/digest";
const SLUG = "daily-digest";
const PRICE = "0.50";

if (!KEY) {
  console.error("Set CODESPAR_API_KEY. Use csk_test_... to rehearse on Base Sepolia first, csk_live_... to sell for real on Base mainnet.");
  process.exit(1);
}
if (!CONSUMER_ID) {
  console.error("Set CODESPAR_CONSUMER_ID, the CodeSpar-provisioned wallet that receives the $0.50 per call. Get one at codespar.dev.");
  process.exit(1);
}

console.log(`Creating paywall "${SLUG}" in front of ${UPSTREAM}, priced at $${PRICE} USDC ...`);

const res = await fetch(`${API}/v1/paywalls`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${KEY}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    slug: SLUG,
    name: "Daily digest",
    upstream_url: UPSTREAM,
    price: PRICE,
    currency: "USDC",
    payto: { kind: "provisioned", consumer_id: CONSUMER_ID },
  }),
});

if (!res.ok) {
  console.error(`create failed: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}

const paywall = await res.json();
const gatewayUrl = paywall.gateway_url ?? `https://gw.codespar.dev/${SLUG}`;

console.log(`live at ${gatewayUrl}`);
console.log(`\nThis is an ordinary api-paywall, priced once. What makes it recurring is a mandate on`);
console.log(`the buyer side, not this endpoint. Next: size a month's budget and start the daily job:`);
console.log(`  node buyer.mjs setup --payee ${gatewayUrl}`);
