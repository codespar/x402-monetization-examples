// Seller side: an AR agent issues a $2,400 freight invoice as a one-time
// CodeSpar payment link.
//
// One link, one rail (USDC/x402), one payment. There is no upstream to
// proxy and no per-call metering: the link IS the invoice. `one_time: true`
// plus `max_uses: 1` close it the instant it is paid, so a second call
// against the same link cannot double-charge the buyer.
//
//   CODESPAR_API_KEY=csk_test_... CONSUMER_ID=your_consumer_id node seller.mjs
//
// No dependencies. Node 18+ (built-in fetch).
// Prints the link the buyer's AP agent pays at: https://gw.codespar.dev/pay/<slug>

const API = process.env.CODESPAR_API_BASE ?? "https://api.codespar.dev";
const KEY = process.env.CODESPAR_API_KEY;
const CONSUMER_ID = process.env.CONSUMER_ID;
const INVOICE = process.env.INVOICE_TITLE ?? "Freight invoice #4471";
const AMOUNT = process.env.AMOUNT ?? "2400.00";

if (!KEY) {
  console.error("Set CODESPAR_API_KEY to a csk_test_ (Base Sepolia) or csk_live_ (mainnet) key.");
  process.exit(1);
}
if (!CONSUMER_ID) {
  console.error("Set CONSUMER_ID to the provisioned consumer_id that should receive the $2,400 USDC.");
  process.exit(1);
}

console.log(`Issuing "${INVOICE}" as a one-time payment link for $${AMOUNT} USDC ...`);

const res = await fetch(`${API}/v1/payment-links`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${KEY}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    title: INVOICE,
    accepts: [
      { rail: "x402", amount: AMOUNT, pay_to: { kind: "provisioned", consumer_id: CONSUMER_ID } },
    ],
    one_time: true,
    max_uses: 1,
  }),
});

if (!res.ok) {
  console.error(`create failed: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}

const link = await res.json();
// The slug is server-assigned (this create sends none), so "invoice-4471" is
// the invoice number, never the URL. Read the URL off the response.
// See https://docs.codespar.dev/docs/api/payment-links
const gatewayUrl = link.pay_url;
if (!gatewayUrl) {
  console.error(`created, but the response carries no pay_url: ${JSON.stringify(link)}`);
  process.exit(1);
}

console.log(`Live at ${gatewayUrl}`);
console.log(`  $${AMOUNT} USDC to consumer ${CONSUMER_ID}, one payment, then the link closes.`);
console.log(`\nHand ${gatewayUrl} to the buyer's AP agent as the payee on a mandate:`);
console.log(`  codespar mandate create --consumer <buyer> --agent payer --payee ${gatewayUrl} --slot USDC:usdc:2400000000:2400000000`);
console.log(`See ./buyer.sh or ../../cli/README.md for the rest of the buyer-side flow.`);
