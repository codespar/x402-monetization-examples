// Buyer side: pay the USDC/x402 leg of a store-checkout link, print the
// receipt, then show that a second attempt does not sell a second pair.
//
// Standard x402 client, same pattern as ../../buyer/pay.mjs. The link this
// pays also advertises a Pix leg (see seller.mjs and the README), but this
// script only exercises the USDC leg, since that is the leg that actually
// settles today.
//
//   cd use-cases/store-checkout
//   npm install
//   PRIVATE_KEY=0x... node buyer.mjs https://gw.codespar.dev/pay/aro-runner-xxxx
//
// Use a Base Sepolia faucet and a csk_test_ link first; point at mainnet
// only with a funded wallet.

import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const url = process.argv[2];

if (!PRIVATE_KEY) {
  console.error("Set PRIVATE_KEY to a funded Base wallet.");
  process.exit(1);
}
if (!url) {
  console.error("Usage: node buyer.mjs https://gw.codespar.dev/pay/<slug>");
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);
const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(account));
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

console.log(`Paying the USDC leg of ${url} (payer ${account.address}) ...`);
const res = await fetchWithPayment(url);
console.log(`status: ${res.status}`);

const body = await res.json().catch(() => ({}));
console.log("response:", JSON.stringify(body, null, 2));

if (body.paid) {
  console.log(`\nPaid. receipt_id ${body.receipt_id}, tx ${body.tx}.`);
  if (body.redirect_url) console.log(`redirect_url: ${body.redirect_url}`);
} else {
  console.log(`\nNot paid. Check the response above (link may already be spent, or the price/network did not match).`);
}

console.log(`\nCalling the same link again (max_uses: 1 is spent after one sale) ...`);
const repeat = await fetchWithPayment(url);
console.log(`status: ${repeat.status} (expect 409 or 410, not a fresh 402: the pair is already sold)`);
