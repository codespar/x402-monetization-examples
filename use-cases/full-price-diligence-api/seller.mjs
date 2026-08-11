// Create the api-paywall for a single company ownership-structure report,
// priced at $85.00 in USDC. No subscription, no free tier, no cents-level
// trickle pricing: one paid GET returns one report.
//
// This is the exact POST /v1/paywalls call from ../../api-paywall/README.md,
// with a different slug, upstream, and price. No x402 client needed here;
// the signing happens on the buyer side, with the repo's own buyer/pay.mjs.
//
//   cp .env.example .env   # fill in the three values
//   npm run create
//
// or just:
//   CODESPAR_API_KEY=csk_live_... CODESPAR_CONSUMER_ID=... \
//   UPSTREAM_URL=https://api.yourservice.com/reports/company node seller.mjs

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
const UPSTREAM = process.env.UPSTREAM_URL ?? "https://api.yourservice.com/reports/company";
const SLUG = "company-diligence-report";
const PRICE = "85.00";

if (!KEY) {
  console.error("Set CODESPAR_API_KEY. Use csk_live_... to sell for real on Base mainnet, csk_test_... to rehearse on Base Sepolia first.");
  process.exit(1);
}
if (!CONSUMER_ID) {
  console.error("Set CODESPAR_CONSUMER_ID, the CodeSpar-provisioned wallet that receives the $85. Get one at codespar.dev.");
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
    name: "Company ownership-structure report",
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
console.log(`\nAn agent that GETs this URL unpaid gets a 402 advertising 85000000 atomic USDC ($85.00).`);
console.log(`Pay it with the repo's buyer script, unmodified:`);
console.log(`  cd ../../buyer && npm install`);
console.log(`  PRIVATE_KEY=0x... node pay.mjs ${gatewayUrl}`);
