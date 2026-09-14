// buyer.sh must not allowlist a mandate to a payment link nobody issued.
//
// The invoice example's payee is the URL of a link the seller just created, and
// CodeSpar assigns that link's slug. A default of gw.codespar.dev/pay/invoice-4471
// is a guess: `codespar mandate create --payee <that>` caps and allowlists a
// real mandate against a URL that answers 404 payment_link_not_found.
//
// The CodeSpar CLI is stubbed on PATH, so this test never reaches the network
// and never creates a mandate. The stub records the argv it was called with.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const buyerSh = fileURLToPath(new URL("../use-cases/b2b-invoice/buyer.sh", import.meta.url));

/** A PATH where `codespar` is a recorder, not the real CLI. */
function stubCli() {
  const dir = mkdtempSync(join(tmpdir(), "codespar-cli-stub-"));
  const log = join(dir, "argv.log");
  const bin = join(dir, "codespar");
  writeFileSync(bin, `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> ${JSON.stringify(log)}\nexit 0\n`);
  chmodSync(bin, 0o755);
  return { dir, log, calls: () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : []) };
}

async function runBuyer(env, stub) {
  try {
    const { stdout, stderr } = await execFileAsync("bash", [buyerSh], {
      env: { PATH: `${stub.dir}:/usr/bin:/bin`, HOME: process.env.HOME, ...env },
      timeout: 30_000,
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

test("buyer.sh refuses to run without a PAYEE_URL from the seller", async () => {
  const stub = stubCli();
  const run = await runBuyer({}, stub);

  assert.deepEqual(
    stub.calls(),
    [],
    `buyer.sh created a mandate with a payee the seller never issued: ${JSON.stringify(stub.calls())}`,
  );
  assert.notEqual(run.code, 0, `expected a non-zero exit, got ${run.code}\n${run.stdout}${run.stderr}`);
  assert.match(`${run.stdout}${run.stderr}`, /PAYEE_URL/, "it should say which variable to set");
});

test("buyer.sh passes the seller's URL straight through as the payee", async () => {
  // Positive control: the guard above is the guard, not a broken script. With a
  // payee set, buyer.sh runs to the end and hands the CLI exactly that URL.
  const stub = stubCli();
  const payee = "https://gw.codespar.dev/pay/pl-issued-by-the-server";
  const run = await runBuyer({ PAYEE_URL: payee }, stub);

  assert.equal(run.code, 0, `${run.stdout}${run.stderr}`);
  const calls = stub.calls();
  assert.equal(calls.length, 1, `expected one CLI call, got ${JSON.stringify(calls)}`);
  assert.match(calls[0], /^mandate create /, calls[0]);
  assert.ok(calls[0].includes(`--payee ${payee}`), `payee not passed through: ${calls[0]}`);
});
