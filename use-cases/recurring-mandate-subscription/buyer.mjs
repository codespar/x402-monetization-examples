// Buyer side: pay the same api-paywall endpoint once a day for a month,
// under one mandate a human sizes once. Wraps the CodeSpar CLI, the
// governed buyer path documented in ../../cli/README.md. There is no HTTP
// endpoint for mandate/spend, only the CLI, so this script shells out to it
// rather than inventing one.
//
//   npm install -g @codespar/cli
//   codespar login
//
//   # One-time setup: size the mandate for 30 daily calls at $0.50 each.
//   node buyer.mjs setup --payee https://gw.codespar.dev/daily-digest
//   # -> prints a mandate id. Save it as MANDATE_ID.
//
//   # Once a day, run by cron or the agent's own scheduler:
//   MANDATE_ID=mnd_... node buyer.mjs run-day --payee https://gw.codespar.dev/daily-digest
//
// This script does not loop or sleep for a month on its own; it is the unit
// a scheduler invokes once a day. A crontab line that actually makes it
// recurring:
//
//   0 8 * * * MANDATE_ID=mnd_... node /path/to/buyer.mjs run-day \
//     --payee https://gw.codespar.dev/daily-digest >> daily-digest.log 2>&1

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const PER_TX_CAP = 500_000; // $0.50 in USDC atomic units (6 decimals)
const DAYS = 30;
const TOTAL_CAP = PER_TX_CAP * DAYS; // 15,000,000 atomic units = $15.00 for the month

const [mode, ...rest] = process.argv.slice(2);
const payeeIndex = rest.indexOf("--payee");
const payee = payeeIndex >= 0 ? rest[payeeIndex + 1] : null;

function usage() {
  console.error("Usage: node buyer.mjs <setup|run-day> --payee https://gw.codespar.dev/<slug>");
  process.exit(1);
}

if (mode !== "setup" && mode !== "run-day") usage();
if (!payee || !/^https:\/\/\S+$/.test(payee)) usage();

async function cli(args) {
  console.log(`  $ codespar ${args.join(" ")}`);
  try {
    const { stdout } = await run("codespar", args);
    process.stdout.write(stdout);
    return stdout;
  } catch (err) {
    console.error(`  codespar CLI failed: ${err.stderr?.toString().trim() || err.message}`);
    process.exit(1);
  }
}

if (mode === "setup") {
  console.log(
    `Sizing a mandate for ${DAYS} daily calls at $0.50 each ($${(TOTAL_CAP / 1e6).toFixed(2)} total cap) against ${payee} ...\n`
  );
  await cli([
    "mandate", "create",
    "--consumer", "shopper",
    "--agent", "buyer",
    "--payee", payee,
    "--slot", `USDC:usdc:${TOTAL_CAP}:${PER_TX_CAP}`,
  ]);
  console.log("\nSave the mandate id printed above as MANDATE_ID; the daily job needs it.");
} else {
  const mandateId = process.env.MANDATE_ID;
  if (!mandateId) {
    console.error("Set MANDATE_ID to the id printed by `node buyer.mjs setup`.");
    process.exit(1);
  }

  console.log(`Paying today's call to ${payee} ...\n`);
  await cli([
    "spend",
    "--mandate", mandateId,
    "--amount", String(PER_TX_CAP),
    "--agent", "buyer",
    "--payee", payee,
  ]);

  console.log("\nCap remaining on the mandate:");
  await cli(["wallet", "shopper"]);
}
