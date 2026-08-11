// Buyer side of the cross-border agent mandate example: one CodeSpar
// mandate, two slots, paid back to back in the same run.
//
//   [1] codespar mandate create   USDC slot for the MCP payee + BRL/Pix slot for the payment link
//   [2] codespar spend            pay the "translate" MCP tool, 0.03 USDC
//   [3] codespar spend            pay the payment link, R$35.00 via Pix
//   [4] codespar wallet           print both slots side by side, no FX between them
//
// This shells out to the CodeSpar CLI (see ../../cli/README.md for what each
// flag means; this script runs exactly those commands and nothing else), so
// it needs:
//
//   npm install -g @codespar/cli
//   codespar login
//
// then, once seller.mjs has printed the two gateway URLs:
//
//   MCP_GATEWAY_URL=https://gw.codespar.dev/mcp/translate-mcp \
//   PAYMENT_LINK_URL=https://gw.codespar.dev/pay/<slug> \
//   npm run buyer

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const CONSUMER = process.env.CODESPAR_CONSUMER ?? "shopper";
const AGENT = process.env.CODESPAR_AGENT ?? "buyer";
const MCP_GATEWAY_URL = process.env.MCP_GATEWAY_URL;
const PAYMENT_LINK_URL = process.env.PAYMENT_LINK_URL;
const MANDATE_ID = process.env.MANDATE_ID; // set this to skip step 1 and reuse an existing mandate

function requireHttpUrl(name, value) {
  if (!value || !/^https?:\/\//.test(value)) {
    console.error(`Set ${name} to an https:// gateway URL (from seller.mjs).`);
    process.exit(1);
  }
  return value;
}
requireHttpUrl("MCP_GATEWAY_URL", MCP_GATEWAY_URL);
requireHttpUrl("PAYMENT_LINK_URL", PAYMENT_LINK_URL);

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

let mandateId = MANDATE_ID;
if (!mandateId) {
  console.log(`\n[1/4] Creating one mandate with a USDC slot and a BRL/Pix slot ...`);
  const out = await codespar(
    [
      "mandate", "create",
      "--consumer", CONSUMER,
      "--agent", AGENT,
      "--payee", MCP_GATEWAY_URL,
      "--payee", PAYMENT_LINK_URL,
      "--slot", "USDC:usdc:1000000:50000",
      "--slot", "BRL:pix:100000:5000",
    ],
    "mandate create",
  );
  // `codespar mandate create` does not document a machine-readable output
  // flag, so this scrapes an id-shaped token out of stdout. If your
  // installed CLI's output format differs, run the command yourself and
  // set MANDATE_ID to skip this step entirely.
  const match =
    out.match(/\bmandate[_-][a-zA-Z0-9]+\b/) ||
    out.match(/"id"\s*:\s*"([^"]+)"/i) ||
    out.match(/\bID:\s*(\S+)/i);
  mandateId = match ? match[1] ?? match[0] : null;
  if (!mandateId) {
    console.error(`\nCouldn't parse a mandate id from the output above. Re-run with MANDATE_ID=<id> set by hand.`);
    process.exit(1);
  }
  console.log(`  mandate ${mandateId}`);
}

console.log(`\n[2/4] Paying the MCP tool in USDC (0.03 USDC = 30000 atomic units) ...`);
await codespar(
  ["spend", "--mandate", mandateId, "--amount", "30000", "--agent", AGENT, "--payee", MCP_GATEWAY_URL],
  "spend (USDC leg)",
);

console.log(`\n[3/4] Paying the payment link in Pix (R$35.00 = 3500 minor units) ...`);
await codespar(
  ["spend", "--mandate", mandateId, "--amount", "3500", "--agent", AGENT, "--payee", PAYMENT_LINK_URL],
  "spend (Pix leg)",
);

console.log(`\n[4/4] Wallet, both slots side by side ...`);
await codespar(["wallet", CONSUMER], "wallet");

console.log(
  `\nDone. One mandate, one signature, two receipts: a USDC leg and a Pix leg, no FX between them.`,
);
console.log(
  `The Pix leg above runs the same governed pipeline as the USDC leg; it does not move real BRL until our banking partner's production credentials are live (see ../README.md, Honesty).`,
);
