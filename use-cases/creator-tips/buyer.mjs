// Creator tips: buyer side (an autonomous research agent, not a person).
//
//   [1] Pay the article paywall in USDC over x402 to pull the excerpt.
//       Standard x402 client, the same pattern as ../../buyer/pay.mjs.
//       This leg is the proven, production path.
//   [2] Settle the tip link's Pix leg: R$5.00 straight to the journalist's
//       real Pix key. POST /pay/:slug/settle with { mandate, signature },
//       exactly as ../../payment-link/README.md documents. The mandate
//       carries a BRL:pix slot, signed ahead of time (see the README for
//       the `codespar mandate create` step). This script does not build or
//       sign a mandate; it only forwards the { mandate, signature } pair it
//       was handed to the documented endpoint.
//
// The agent never opens a bank app or scans a QR code: the excerpt is paid
// for in USDC, the tip is denominated in BRL, and both legs are initiated
// by code under a governed cap, not by a person.
//
//   cp .env.example .env
//   npm install
//   PRIVATE_KEY=0x... node buyer.mjs
//   # add MANDATE='{"...":"..."}' MANDATE_SIGNATURE=0x... to also settle the tip

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

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ARTICLE_GATEWAY_URL = process.env.ARTICLE_GATEWAY_URL ?? "https://gw.codespar.dev/journalist-article";
const TIP_LINK_SLUG = process.env.TIP_LINK_SLUG;
const MANDATE_RAW = process.env.MANDATE;
const MANDATE_SIGNATURE = process.env.MANDATE_SIGNATURE;

if (!PRIVATE_KEY) {
  console.error("Set PRIVATE_KEY to a funded Base wallet, to pay the USDC excerpt.");
  console.error("Use a Base Sepolia wallet and a csk_test_ paywall first.");
  process.exit(1);
}

console.log(`\n[1/2] Paying the article paywall in USDC ...`);
const account = privateKeyToAccount(PRIVATE_KEY);
const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(account));
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const paid = await fetchWithPayment(ARTICLE_GATEWAY_URL);
console.log(`  HTTP ${paid.status}`);
console.log(`  payment: ${paid.headers.get("payment-response")}`);
const excerpt = await paid.text();
console.log(`  excerpt: ${excerpt.slice(0, 200).trim()}`);

if (!TIP_LINK_SLUG || !MANDATE_RAW || !MANDATE_SIGNATURE) {
  console.log(`\n[2/2] Skipping the Pix tip: set TIP_LINK_SLUG, MANDATE, and MANDATE_SIGNATURE.`);
  console.log(`  Sign a mandate with a BRL:pix slot first, e.g.:`);
  console.log(`    codespar mandate create --consumer research-agent --agent tipper \\`);
  console.log(`      --payee https://gw.codespar.dev/pay/<tip-slug> \\`);
  console.log(`      --slot BRL:pix:50000:500`);
  console.log(`  See ../../cli/README.md for the full flow.`);
  process.exit(0);
}

console.log(`\n[2/2] Settling the tip: R\$5.00 to the journalist's Pix key ...`);
let mandate;
try {
  mandate = JSON.parse(MANDATE_RAW);
} catch {
  mandate = MANDATE_RAW; // accept a raw token/string too; passed through as-is
}
const tipRes = await fetch(`https://gw.codespar.dev/pay/${TIP_LINK_SLUG}/settle`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ mandate, signature: MANDATE_SIGNATURE }),
});
console.log(`  HTTP ${tipRes.status}`);
console.log(`  ${await tipRes.text()}`);

console.log(`\nDone. The excerpt settled live in USDC.`);
console.log(`The Pix tip request used the real endpoint shape, but it does not move real BRL yet:`);
console.log(`the Pix leg is code-complete and gated on our banking partner's production credentials.`);
