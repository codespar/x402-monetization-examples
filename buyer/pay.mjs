// Pay any x402 endpoint automatically, with the standard x402 client.
//
// The wrapped fetch reads the HTTP 402 challenge, signs an EIP-3009
// authorization for the advertised amount, retries, and returns the resource.
// Works against any x402 endpoint, including a CodeSpar gateway URL.
//
//   cd buyer && npm install
//   PRIVATE_KEY=0x... node pay.mjs https://gw.codespar.dev/your-slug
//
// Use a Base Sepolia faucet and a csk_test_ paywall first; point at mainnet
// only with a funded wallet.

import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const url = process.argv[2] ?? "https://gw.codespar.dev/your-slug";

if (!PRIVATE_KEY) {
  console.error("Set PRIVATE_KEY to a funded Base wallet.");
  process.exit(1);
}

const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(privateKeyToAccount(PRIVATE_KEY)));
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const res = await fetchWithPayment(url); // auto-pays on 402, then returns the resource
console.log("status:", res.status);
console.log("payment:", res.headers.get("payment-response"));
console.log(await res.text());
