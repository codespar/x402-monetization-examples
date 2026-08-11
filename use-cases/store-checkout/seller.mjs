// Seller side: create a store-checkout payment link for one physical SKU.
//
// One link, two rails, one sale. A $89 / R$450 sneaker gets a USDC/x402 leg
// and a Pix leg on the same link, each priced independently (no FX).
// `one_time: true` plus `max_uses: 1` closes the link the moment either leg
// pays, so it behaves like a single-unit checkout, not a metered API.
//
//   cd use-cases/store-checkout
//   npm install
//   CODESPAR_API_KEY=csk_test_... CONSUMER_ID=your_consumer_id node seller.mjs
//
// Prints the checkout URL a buyer pays at: https://gw.codespar.dev/pay/<slug>

const API = process.env.CODESPAR_API_BASE ?? "https://api.codespar.dev";
const KEY = process.env.CODESPAR_API_KEY;
const CONSUMER_ID = process.env.CONSUMER_ID;
const PIX_KEY = process.env.PIX_KEY ?? "loja@pix.br";

if (!KEY) {
  console.error("Set CODESPAR_API_KEY to a csk_test_ (Base Sepolia) or csk_live_ (mainnet) key.");
  process.exit(1);
}
if (!CONSUMER_ID) {
  console.error("Set CONSUMER_ID to the provisioned consumer_id that should receive the USDC leg.");
  process.exit(1);
}

const slug = `aro-runner-${Date.now().toString(36)}`;

console.log(`Creating checkout link "${slug}" for one Aro Runner sneaker ...`);
const res = await fetch(`${API}/v1/payment-links`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${KEY}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    title: "Aro Runner sneaker",
    accepts: [
      { rail: "x402", amount: "89.00", pay_to: { kind: "provisioned", consumer_id: CONSUMER_ID } },
      { rail: "pix", amount: "450.00", pix: { key: PIX_KEY } },
    ],
    one_time: true,
    max_uses: 1,
    redirect_url: "https://yourstore.com/thanks",
  }),
});

if (!res.ok) {
  console.error(`create failed: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}

const link = await res.json();
const gatewayUrl = link.gateway_url ?? `https://gw.codespar.dev/pay/${slug}`;

console.log(`Live at ${gatewayUrl}`);
console.log(`  USDC leg: $89.00 to consumer ${CONSUMER_ID} (settles live over x402)`);
console.log(`  Pix leg:  R$450.00 to ${PIX_KEY} (code-complete; needs our banking partner's production creds to move real BRL)`);
console.log(`\nOne sale closes it: max_uses is 1. Hand ${gatewayUrl} to a buyer.`);
console.log(`Pay the USDC leg with: node buyer.mjs ${gatewayUrl}`);
