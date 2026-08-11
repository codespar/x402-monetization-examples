// Buyer side of the agent shopping cart: three unrelated sellers, three
// mandates, one wallet.
//
//   [1] codespar mandate create   x3, one per payee, each capped at that payee's price
//   [2] codespar spend            x3, pay each mandate against its payee
//   [3] codespar wallet shopper   all three debits, one consumer
//
// This shells out to the CodeSpar CLI (see ../../cli/README.md for what each
// flag means; this script runs exactly those commands and nothing else), so
// it needs:
//
//   npm install -g @codespar/cli
//   codespar login
//
// then, once seller.mjs has written .cart.json:
//
//   npm run buyer
//
// Override any payee with an env var (e.g. MCP_URL=https://... npm run buyer)
// to point at resources you created yourself instead of .cart.json.

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { promisify } from "node:util";

const run = promisify(execFile);

const CONSUMER = process.env.CODESPAR_CONSUMER ?? "shopper";
const AGENT = process.env.CODESPAR_AGENT ?? "buyer";

const cartPath = new URL("./.cart.json", import.meta.url);
const cart = existsSync(cartPath) ? JSON.parse(readFileSync(cartPath, "utf8")) : {};

function requireHttpUrl(name, value) {
  if (!value || !/^https?:\/\//.test(value)) {
    console.error(`Set ${name} to an https:// gateway URL (from seller.mjs / .cart.json).`);
    process.exit(1);
  }
  return value;
}

const legs = [
  {
    name: "market-data paywall",
    payee: requireHttpUrl("MARKET_DATA_URL", process.env.MARKET_DATA_URL ?? cart.paywall_url),
    amount: "10000", // $0.01 in atomic USDC (6 decimals)
    mandateId: process.env.MARKET_DATA_MANDATE_ID,
  },
  {
    name: "analytics MCP tool",
    // `codespar spend` treats this the same as the paywall above: a single
    // http(s) payee. The MCP gateway prices one tool ("screen"), so this
    // assumes the CLI's x402 routing calls it the same way it calls a
    // paywall. If your CLI version needs a --tool flag or a JSON-RPC body to
    // pick which tool to call, check `codespar spend --help`; this repo does
    // not pin that flag.
    payee: requireHttpUrl("MCP_URL", process.env.MCP_URL ?? cart.mcp_url),
    amount: "20000", // $0.02
    mandateId: process.env.MCP_MANDATE_ID,
  },
  {
    name: "cart-checkout payment link",
    payee: requireHttpUrl("PAYMENT_LINK_URL", process.env.PAYMENT_LINK_URL ?? cart.payment_link_url),
    amount: "15000000", // $15.00
    mandateId: process.env.PAYMENT_LINK_MANDATE_ID,
  },
];

async function codespar(args, label) {
  console.log(`\n$ codespar ${args.join(" ")}`);
  try {
    const { stdout, stderr } = await run("codespar", args);
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.error(stderr.trim());
    return stdout;
  } catch (err) {
    console.error(`  ${label} failed: ${err.stderr || err.message}`);
    console.error(`  Is the CodeSpar CLI installed and are you logged in? npm install -g @codespar/cli && codespar login`);
    process.exit(1);
  }
}

console.log(`\n[1/3] Creating one mandate per seller, under consumer "${CONSUMER}" ...`);
for (const leg of legs) {
  if (leg.mandateId) {
    console.log(`  ${leg.name}: using mandate id override ${leg.mandateId}`);
    continue;
  }
  const out = await codespar(
    [
      "mandate", "create",
      "--consumer", CONSUMER,
      "--agent", AGENT,
      "--payee", leg.payee,
      "--slot", `USDC:usdc:${leg.amount}:${leg.amount}`,
    ],
    `mandate create (${leg.name})`,
  );
  // `codespar mandate create` does not document a machine-readable output
  // flag, so this scrapes an id-shaped token out of stdout. If your
  // installed CLI's output format differs, run the command yourself and set
  // the matching *_MANDATE_ID env var to skip this step entirely.
  const match =
    out.match(/\bmandate[_-][a-zA-Z0-9]+\b/) ||
    out.match(/"id"\s*:\s*"([^"]+)"/i) ||
    out.match(/\bID:\s*(\S+)/i);
  leg.mandateId = match ? match[1] ?? match[0] : null;
  if (!leg.mandateId) {
    console.error(`\nCouldn't parse a mandate id for ${leg.name} from the output above.`);
    console.error(`Re-run with the matching *_MANDATE_ID env var set by hand.`);
    process.exit(1);
  }
  console.log(`  ${leg.name}: mandate ${leg.mandateId}`);
}

console.log(`\n[2/3] Spending against each mandate, in sequence ...`);
for (const leg of legs) {
  console.log(`\n  Paying ${leg.name} (${leg.payee}) ...`);
  await codespar(
    ["spend", "--mandate", leg.mandateId, "--amount", leg.amount, "--agent", AGENT, "--payee", leg.payee],
    `spend (${leg.name})`,
  );
}

console.log(`\n[3/3] Wallet for "${CONSUMER}", all three debits under one consumer ...`);
await codespar(["wallet", CONSUMER], "wallet");

console.log(
  `\nDone. One CodeSpar wallet paid three unrelated sellers, a paywall, an MCP tool, and a payment link, all in USDC, under the same mandate-and-spend signature model.`,
);
