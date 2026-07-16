// End-to-end x402 demo, on Base Sepolia.
//
//   [1] Seller: POST /v1/paywalls creates gw.codespar.dev/<slug> in front of a
//       public upstream, priced at $0.01.
//   [2] The unpaid call: we show the raw HTTP 402 challenge.
//   [3] Buyer: an @x402/fetch client signs an EIP-3009 authorization, settles
//       USDC on Base Sepolia, retries, and gets the resource.
//   [4] Cleanup: the demo paywall is deleted.
//
// Runs on a csk_test_ key and Base Sepolia only. It never touches mainnet.
//
//   cp .env.example .env   # fill in the two keys
//   npm install
//   npm start

import { readFileSync } from "node:fs";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

// Minimal .env loader (no dependency). Real environment variables win.
try {
  for (const line of readFileSync(new URL("./.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const API = process.env.CODESPAR_API_BASE ?? "https://api.codespar.dev";
const KEY = process.env.CODESPAR_API_KEY;
const PK = process.env.PRIVATE_KEY;
const UPSTREAM = process.env.UPSTREAM_URL ?? "https://api.github.com/zen";

if (!KEY || !KEY.startsWith("csk_test_")) {
  console.error("Set CODESPAR_API_KEY to a csk_test_ key. This demo is Base Sepolia only.");
  process.exit(1);
}
if (!PK) {
  console.error("Set PRIVATE_KEY to a Base Sepolia wallet funded with a little test USDC.");
  process.exit(1);
}

const account = privateKeyToAccount(PK);
const payTo = process.env.PAYTO_ADDRESS ?? account.address;
const slug = `demo-${Date.now().toString(36)}`;

const authed = (path, init = {}) =>
  fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

// Try base64-JSON, then plain JSON, then the raw string.
function decodeHeader(v) {
  if (!v) return null;
  try { return JSON.parse(Buffer.from(v, "base64").toString("utf8")); } catch {}
  try { return JSON.parse(v); } catch {}
  return v;
}

// A freshly-created paywall may take a moment to propagate to the gateway.
async function waitForGateway(url, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url);
    if (r.status !== 404) return r;
    await new Promise((res) => setTimeout(res, 1000));
  }
  return fetch(url);
}

console.log(`\n[1/4] Creating paywall "${slug}" in front of ${UPSTREAM} ...`);
const createRes = await authed("/v1/paywalls", {
  method: "POST",
  body: JSON.stringify({
    slug,
    name: "x402 end-to-end demo",
    upstream_url: UPSTREAM,
    price: "0.01",
    currency: "USDC",
    payto: { kind: "byo", address: payTo },
  }),
});
if (!createRes.ok) {
  console.error(`  create failed: HTTP ${createRes.status} ${await createRes.text()}`);
  process.exit(1);
}
const paywall = await createRes.json();
const gatewayUrl = paywall.gateway_url ?? `https://gw.codespar.dev/${slug}`;
const paywallId = paywall.id;
console.log(`  live at ${gatewayUrl}`);

try {
  console.log(`\n[2/4] Calling it with no payment ...`);
  const unpaid = await waitForGateway(gatewayUrl);
  console.log(`  HTTP ${unpaid.status}`);
  const challenge = decodeHeader(unpaid.headers.get("payment-required"));
  const terms = challenge?.accepts?.[0];
  if (terms) {
    console.log(`  challenge: pay ${terms.amount} atomic USDC on ${terms.network} to ${terms.payTo}`);
  }

  console.log(`\n[3/4] Paying with an x402 client (payer ${account.address}) ...`);
  const client = new x402Client();
  client.register("eip155:*", new ExactEvmScheme(account));
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);
  const paid = await fetchWithPayment(gatewayUrl);
  console.log(`  HTTP ${paid.status}`);
  const settlement = decodeHeader(paid.headers.get("payment-response"));
  if (settlement && typeof settlement === "object") {
    console.log(`  settled tx ${settlement.transaction ?? settlement.txHash ?? "(in header)"} on ${settlement.network ?? "Base Sepolia"}`);
  }
  const body = await paid.text();
  console.log(`  upstream returned: ${body.slice(0, 200).trim()}`);
  console.log(`\nDone. An agent paid $0.01 in USDC over x402 and got the resource.`);
} finally {
  if (paywallId) {
    console.log(`\n[4/4] Deleting demo paywall ${paywallId} ...`);
    await authed(`/v1/paywalls/${paywallId}`, { method: "DELETE" }).catch(() => {});
  }
}
