// Burn a governed mandate down to zero against a priced MCP server, and
// watch the two caps that make it fail safe: per-tx and total.
//
// This shells out to the CodeSpar CLI (`codespar`), documented in
// cli/README.md, exactly as documented there. It does not talk to the
// gateway directly; the commands below are commands you could type by hand.
//
//   npm install -g @codespar/cli
//   codespar login
//   node seller.mjs                             # registers the MCP server
//
//   # Step 1: create the mandate (no CODESPAR_MANDATE_ID set yet)
//   node buyer.mjs
//
//   # Step 2: copy the mandate id it prints, then run the burn-down
//   CODESPAR_MANDATE_ID=<mandate-id> node buyer.mjs
//
// The exact text `codespar spend` prints on success or rejection can vary by
// CLI version. This script only relies on the exit code (0 = paid, nonzero =
// blocked), and prints whatever the CLI printed alongside it.

import { spawnSync } from "node:child_process";

const GATEWAY_URL = process.env.MCP_GATEWAY_URL ?? "https://gw.codespar.dev/mcp/agent-budget-mcp";
const CONSUMER = process.env.CODESPAR_CONSUMER ?? "agent-budget-demo";
const AGENT = process.env.CODESPAR_AGENT ?? "budget-agent";
const MANDATE_ID = process.env.CODESPAR_MANDATE_ID;

// USDC minor units (6 decimals). Matches the --slot below and seller.mjs's prices.
const TOTAL_CAP = 2_000_000; // $2.00
const PER_TX_CAP = 1_000_000; // $1.00
const SUMMARIZE_PRICE = 50_000; // $0.05
const DEEP_ANALYSIS_PRICE = 1_500_000; // $1.50, above PER_TX_CAP on purpose

const usd = (atomic) => `$${(atomic / 1_000_000).toFixed(2)}`;

function codespar(args) {
  const res = spawnSync("codespar", args, { encoding: "utf8" });
  return {
    ok: res.status === 0,
    status: res.status,
    stdout: (res.stdout ?? "").trim(),
    stderr: (res.stderr ?? "").trim(),
  };
}

function spend(tool, amount) {
  const res = codespar([
    "spend",
    "--mandate", MANDATE_ID,
    "--amount", String(amount),
    "--agent", AGENT,
    "--payee", GATEWAY_URL,
  ]);
  const label = tool.padEnd(13);
  if (res.ok) {
    console.log(`  ok      ${label} ${usd(amount)}`);
  } else {
    const detail = res.stderr || res.stdout || `exit ${res.status}`;
    console.log(`  blocked ${label} ${usd(amount)}  ${detail}`);
  }
  return res.ok;
}

if (!MANDATE_ID) {
  console.log(`Creating a mandate: total cap ${usd(TOTAL_CAP)}, per-tx cap ${usd(PER_TX_CAP)} ...\n`);
  const res = codespar([
    "mandate", "create",
    "--consumer", CONSUMER,
    "--agent", AGENT,
    "--payee", GATEWAY_URL,
    "--slot", `USDC:usdc:${TOTAL_CAP}:${PER_TX_CAP}`,
  ]);
  console.log(res.stdout || res.stderr);
  if (!res.ok) {
    console.error(`\nmandate create failed (exit ${res.status}).`);
    process.exit(1);
  }
  console.log(`\nCopy the mandate id above, then run:`);
  console.log(`  CODESPAR_MANDATE_ID=<mandate-id> node buyer.mjs`);
  process.exit(0);
}

console.log(`[1/3] Burning down the cheap tool (summarize, ${usd(SUMMARIZE_PRICE)} each) ...`);
for (let i = 1; i <= 5; i++) spend("summarize", SUMMARIZE_PRICE);

console.log(`\n[2/3] One deep-analysis call, priced above the per-tx cap ...`);
spend("deep-analysis", DEEP_ANALYSIS_PRICE);

console.log(`\n[3/3] Back to summarize, until the total cap stops it ...`);
let blocked = false;
let calls = 0;
while (!blocked) {
  blocked = !spend("summarize", SUMMARIZE_PRICE);
  calls += 1;
  if (calls > 60) {
    console.error("did not hit the total cap after 60 more calls, stopping (check the mandate's slot).");
    break;
  }
}

console.log(`\nWallet state:`);
const wallet = codespar(["wallet", CONSUMER]);
console.log(wallet.stdout || wallet.stderr);
