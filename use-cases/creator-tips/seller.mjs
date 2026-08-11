// Creator tips: seller side.
//
// Creates the two resources a journalist needs to get paid by an agent:
//
//   [1] An API paywall in front of her article API, priced at $0.02 USDC
//       per pull. POST /v1/paywalls
//   [2] A payment link with a single Pix entry, a R$5.00 tip straight to
//       her real Pix key. POST /v1/payment-links
//
// Run this once to provision both, then point buyer.mjs at the printed
// URLs. This is the seller side only; it never touches Base or Pix itself,
// it just registers the resources.
//
//   cp .env.example .env   # fill in CODESPAR_API_KEY and the payout fields
//   node seller.mjs

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
const ARTICLE_API_URL = process.env.ARTICLE_API_URL ?? "https://api.yourpublication.com/articles/latest";
const CONSUMER_ID = process.env.CONSUMER_ID ?? "your_consumer_id";
const JOURNALIST_PIX_KEY = process.env.JOURNALIST_PIX_KEY ?? "journalist@pix.br";
const PAYWALL_SLUG = process.env.PAYWALL_SLUG ?? "journalist-article";

if (!KEY) {
  console.error("Set CODESPAR_API_KEY. Use a csk_test_ key on Base Sepolia first.");
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

console.log(`\n[1/2] Creating the article paywall in front of ${ARTICLE_API_URL} ...`);
const paywallRes = await authed("/v1/paywalls", {
  method: "POST",
  body: JSON.stringify({
    slug: PAYWALL_SLUG,
    name: "Journalist article API",
    upstream_url: ARTICLE_API_URL,
    price: "0.02",
    currency: "USDC",
    payto: { kind: "provisioned", consumer_id: CONSUMER_ID },
  }),
});
if (!paywallRes.ok) {
  console.error(`  create failed: HTTP ${paywallRes.status} ${await paywallRes.text()}`);
  process.exit(1);
}
const paywall = await paywallRes.json();
const paywallUrl = paywall.gateway_url ?? `https://gw.codespar.dev/${PAYWALL_SLUG}`;
console.log(`  live at ${paywallUrl}`);
console.log(`  price: $0.02 USDC per pull`);

console.log(`\n[2/2] Creating the tip link (R$5.00 Pix, single rail, to ${JOURNALIST_PIX_KEY}) ...`);
const linkRes = await authed("/v1/payment-links", {
  method: "POST",
  body: JSON.stringify({
    title: "Tip the journalist",
    accepts: [{ rail: "pix", amount: "5.00", pix: { key: JOURNALIST_PIX_KEY } }],
  }),
});
if (!linkRes.ok) {
  console.error(`  create failed: HTTP ${linkRes.status} ${await linkRes.text()}`);
  process.exit(1);
}
const link = await linkRes.json();
// The create response for a payment link isn't pinned to one field name in
// the docs (unlike a paywall's gateway_url), so print it raw and take the
// best guess at the URL and slug.
const linkUrl = link.gateway_url ?? link.pay_url ?? link.url;
const tipSlug = link.slug ?? (linkUrl ? linkUrl.split("/").pop() : undefined);
console.log(`  created: ${JSON.stringify(link)}`);
console.log(`  live at ${linkUrl ?? "(see raw response above)"}`);
console.log(`  tip slug: ${tipSlug ?? "(read it off the response above and set TIP_LINK_SLUG)"}`);

console.log(`\nBoth resources are live. Set ARTICLE_GATEWAY_URL=${paywallUrl}`);
console.log(`and TIP_LINK_SLUG=${tipSlug ?? "<slug from above>"} for buyer.mjs.`);
