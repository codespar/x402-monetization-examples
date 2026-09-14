// Every seller example that creates a payment link must print a URL that the
// gateway actually serves.
//
// The examples are copy-paste material: the URL they print is the one a seller
// hands to a buyer. If it points at a slug the server never issued, the buyer
// gets 404 payment_link_not_found and the sale never happens, while the example
// exits 0 and says "Live at ...".
//
// The test runs each seller.mjs for real against a stub that answers with the
// documented payment link object (see ./stub-codespar-api.mjs), then resolves
// the URL the example printed against the same stub's gateway. Nothing here
// mirrors the examples' own logic: the only question asked is whether the
// printed link resolves.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { rmSync } from "node:fs";

import { startStub } from "./stub-codespar-api.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// Placeholder credentials. The stub authenticates nothing; these exist only so
// the examples get past their own required-env guards.
const STUB_ENV = {
  CODESPAR_API_KEY: "csk_test_placeholder_not_a_key",
  CONSUMER_ID: "stub_consumer",
  PIX_KEY: "stub@pix.br",
  UPSTREAM_API_URL: "http://127.0.0.1:1/quotes",
  UPSTREAM_MCP_URL: "http://127.0.0.1:1",
};

async function runSeller(dir, origin) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, ["seller.mjs"], {
      cwd: new URL(`../use-cases/${dir}/`, import.meta.url),
      env: { ...process.env, ...STUB_ENV, CODESPAR_API_BASE: origin },
      timeout: 30_000,
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

/** Every distinct http(s) URL under a /pay/ path that the example printed. */
function payUrlsIn(output) {
  const found = output.match(/https?:\/\/[^\s`'")]+/g) ?? [];
  return [...new Set(found.filter((u) => new URL(u).pathname.startsWith("/pay/")))];
}

// The three examples that create a payment link and print its URL as the thing
// to hand a buyer. (cross-border-agent-mandate and creator-tips also create
// links; they already build the URL from the server's own slug.)
const SELLERS = ["store-checkout", "b2b-invoice", "agent-shopping-cart"];

for (const dir of SELLERS) {
  test(`${dir}/seller.mjs prints a payment link the gateway serves`, async (t) => {
    const stub = await startStub();
    t.after(() => stub.close());
    t.after(() => rmSync(new URL("../use-cases/agent-shopping-cart/.cart.json", import.meta.url), { force: true }));

    const run = await runSeller(dir, stub.origin);
    assert.equal(run.code, 0, `seller.mjs exited ${run.code}\n--- stdout ---\n${run.stdout}\n--- stderr ---\n${run.stderr}`);

    // The stub issued exactly the link this run created, so the set the
    // assertion below discriminates against is seeded, never empty.
    assert.equal(stub.issuedLinkSlugs.size, 1, "the example did not create exactly one payment link");
    const issued = [...stub.issuedLinkSlugs][0];

    // Positive control on the gateway itself: it serves the slug it issued and
    // 404s one it did not, so a 404 below means "this URL is wrong", not "this
    // stub gateway answers 404 to everything".
    assert.equal((await fetch(`${stub.origin}/pay/${issued}`)).status, 200, "control: issued slug must be served");
    assert.equal(
      (await fetch(`${stub.origin}/pay/${issued}-not-issued`)).status,
      404,
      "control: an unissued slug must 404",
    );

    const printed = payUrlsIn(run.stdout);
    assert.equal(printed.length, 1, `expected one payment link URL in the output, got ${JSON.stringify(printed)}\n${run.stdout}`);

    // Resolve what the example told the seller to hand a buyer, against the
    // same gateway that issued the link.
    const path = new URL(printed[0]).pathname;
    const res = await fetch(`${stub.origin}${path}`);
    const body = await res.text();
    assert.equal(
      res.status,
      200,
      `the example printed ${printed[0]}, which the gateway does not serve (HTTP ${res.status} ${body}).\n` +
        `The link it created is at slug "${issued}".`,
    );
  });
}

test("store-checkout/seller.mjs refuses to invent a URL when pay_url is absent", async (t) => {
  // Guard case, not an observed API response: the point is that a missing field
  // must stop the example, never make it print a link it made up.
  const stub = await startStub({ payUrl: "missing" });
  t.after(() => stub.close());

  const run = await runSeller("store-checkout", stub.origin);
  assert.notEqual(run.code, 0, `expected a non-zero exit, got ${run.code}\n${run.stdout}`);
  assert.equal(
    payUrlsIn(run.stdout).length,
    0,
    `printed a payment link URL with no pay_url in the response: ${run.stdout}`,
  );
});
