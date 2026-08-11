# Recurring mandate: one budget pays the same paywall every day for a month

**Maturity: the api-paywall leg is production, settled on Base mainnet, same as [../../api-paywall](../../api-paywall). The mandate, spend, and wallet commands are the same governed CLI path documented in [../../cli](../../cli).**

## What this busts

Two assumptions this example breaks at once. First, that x402 on CodeSpar is a single-cent demo mechanic: this is thirty real charges against a real budget over a real month, not one call. Second, that "recurring" needs a subscription object: it doesn't. A wallet under a mandate can spend the same amount against the same payee as many times as its cap allows, on whatever schedule the caller runs it on. Thirty daily calls are just thirty spends against one cap, no different in kind from one spend against a smaller cap.

## The scenario

A seller runs a daily digest: one HTTP endpoint, `$0.50` a call, fronted by an ordinary [api-paywall](../../api-paywall). Nothing about the paywall is special for this use case; it is created exactly as documented there.

The buyer is an ops agent that wants that digest every day for a month. A human doesn't want to approve thirty individual payments, and doesn't want to hand the agent an unlimited card either. So the human sets a budget once: a mandate with a `total_cap` sized for exactly thirty calls at the paywall's `per_tx_cap` price, and a `--payee` allowlist that locks it to this one paywall. The agent's own scheduler then calls `codespar spend` against that mandate once a day, unattended, until the cap runs out.

```
Day 0    Human   codespar mandate create --slot USDC:usdc:15000000:500000   (cap = 30 x $0.50)
Day 1    Agent   codespar spend --mandate <id> --payee gw.codespar.dev/daily-digest --amount 500000
Day 2    Agent   codespar spend --mandate <id> --payee gw.codespar.dev/daily-digest --amount 500000
  ...
Day 30   Agent   codespar spend --mandate <id> --payee gw.codespar.dev/daily-digest --amount 500000   (cap now 0)
Day 31   Agent   codespar spend ...                                          -> fails, cap exhausted
```

## 1. Seller: create the paywall (once)

Identical to [api-paywall](../../api-paywall); a daily digest is nothing special on the seller side.

```bash
curl -sX POST https://api.codespar.dev/v1/paywalls \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "slug": "daily-digest",
    "name": "Daily digest",
    "upstream_url": "https://api.yourservice.com/digest",
    "price": "0.50",
    "currency": "USDC",
    "payto": { "kind": "provisioned", "consumer_id": "your_consumer_id" }
  }'
```

The `201` response includes `gateway_url`, `https://gw.codespar.dev/daily-digest`. Runnable as [`seller.mjs`](./seller.mjs).

## 2. Buyer: size a mandate for the month (once)

`--slot` is `CURRENCY:RAIL:TOTAL_CAP:PER_TX_CAP`, in USDC minor units (6 decimals), exactly as in [cli/README.md](../../cli). `per_tx_cap` matches the paywall's `$0.50` price (`500000`); `total_cap` is thirty times that (`15000000` = `$15.00`), so the mandate has room for a month of daily calls and no more.

```bash
npm install -g @codespar/cli
codespar login

codespar mandate create --consumer shopper --agent buyer \
  --payee https://gw.codespar.dev/daily-digest \
  --slot USDC:usdc:15000000:500000
```

Save the mandate id the CLI prints; the daily job needs it.

## 3. Agent: pay once a day (repeated, unattended)

The agent's own scheduler, cron, a queue worker, whatever already runs it, calls `codespar spend` against the same mandate and the same `--payee` once a day:

```bash
codespar spend --mandate <mandate-id> --amount 500000 --agent buyer \
  --payee https://gw.codespar.dev/daily-digest
```

`codespar wallet shopper` shows the cap draining call by call: `15000000` remaining before day 1, `14500000` after the first spend, down to `0` after the thirtieth.

```bash
codespar wallet shopper
```

Runnable as [`buyer.mjs`](./buyer.mjs): `node buyer.mjs setup --payee <url>` does step 2 once, `node buyer.mjs run-day --payee <url>` is the daily unit a scheduler invokes (see the crontab line in its header comment).

## What happens on day 31

`total_cap` does not auto-renew. The thirty-first `codespar spend` fails the same cap check any over-cap spend fails, because the mandate has `0` left. CodeSpar has no subscription object behind any of this: it is the same priced paywall, paid repeatedly, under a hard cap that runs out. Getting a fresh period means running `codespar mandate create` again, the same command as step 2, with a fresh `total_cap`; nothing renews itself.

## Files

- [`seller.mjs`](./seller.mjs) creates the `daily-digest` paywall.
- [`buyer.mjs`](./buyer.mjs) does the one-time mandate setup and the once-a-day spend, as two subcommands of one script.

## Honesty

- The api-paywall leg is production, settled on Base mainnet, exactly as documented in [api-paywall](../../api-paywall). Chaining thirty calls to it changes nothing about how any one of them settles.
- The mandate, spend, and wallet commands are the same governed CLI path documented in [cli](../../cli), not a different or higher-trust mechanism invented for this example.
- There is no subscription primitive behind any of this: no auto-renewal, no proration, no cancel-and-refund. A mandate is a cap and a payee allowlist, not a billing plan, and this example's whole point is that a cap sized correctly is enough to make "recurring" safe without one.
- This example is USDC-only and never touches Pix. A payment link can carry a Pix leg alongside USDC (see [payment-link](../../payment-link)), but that leg is code-complete only, not yet moving real BRL in production because it needs our banking partner's production credentials; nothing here should be read as a claim about that.
