# Agent shopping cart: one wallet, three unrelated sellers

**Maturity: mixed. The market-data paywall leg is production, settled on Base mainnet, the same pipeline as [api-paywall](../../api-paywall). The MCP-tool leg and the payment-link leg are preview, per [mcp-server](../../mcp-server) and [payment-link](../../payment-link): built and tested, no dashboard UI yet, and their APIs may still change.**

## What this busts

It's easy to assume x402 monetization means one agent paying one seller once: a single paywall, a single call, done. This example is the opposite. A shopping agent holding one CodeSpar wallet buys from three unrelated sellers in a single script: a market-data API charged per call, a priced tool on an MCP server, and a fixed-amount checkout link. Three different payment shapes, three different price points, the same mandate-and-spend signature model at every stop. The agent never learns a new way to pay when it moves from one seller to the next; it creates a capped mandate and spends against it, the same two CLI calls, and the wallet it holds shows all three debits together at the end.

## The scenario

Three sellers, each running an independent business, register with CodeSpar: a market-data vendor prices its quotes API at $0.01 a call; a tool publisher prices one MCP tool, a ticker screener, at $0.02 a call; a small merchant sells a $15.00 report behind a payment link, one sale, then the link closes. None of the three knows about the other two, and none of them changed anything about how they sell to take an agent's money instead of a person's.

One shopping agent needs something from each of them in the course of one task: a quote, a screen, and the report it's paying for. It holds a single CodeSpar wallet, under the consumer name `shopper`. For each seller it creates a mandate scoped to that seller's URL and capped at what that seller charges, then spends against it. Three mandates, three spends, one wallet. `codespar wallet shopper` at the end shows all three debits side by side, one ledger for a shopping trip across three unrelated storefronts.

The three resources below are created under one CodeSpar account so this example runs from a single API key. In production each would be its own CodeSpar account; nothing about the buyer's flow changes either way, since it only ever sees three ordinary `gw.codespar.dev` URLs.

```
Seller A   POST /v1/paywalls        ──▶  gw.codespar.dev/market-data        ($0.01 USDC/call)
Seller B   POST /v1/mcp-servers     ──▶  gw.codespar.dev/mcp/analytics-mcp  ($0.02 USDC/call)
Seller C   POST /v1/payment-links   ──▶  gw.codespar.dev/pay/<slug>         ($15.00 USDC, one_time)

Buyer (wallet "shopper")
  codespar mandate create  x3   one mandate per payee, capped at that payee's price
  codespar spend            x3   pay each mandate against its payee
  codespar wallet shopper        all three debits, one consumer
```

## 1. Seller: three independent resources

Each call is the exact shape documented in [api-paywall](../../api-paywall), [mcp-server](../../mcp-server), and [payment-link](../../payment-link). Nothing new here, just three of them under one account.

### The market-data paywall

```bash
curl -sX POST https://api.codespar.dev/v1/paywalls \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "slug": "market-data",
    "name": "Market data API",
    "upstream_url": "https://api.yourservice.com/quotes",
    "price": "0.01",
    "currency": "USDC",
    "payto": { "kind": "provisioned", "consumer_id": "your_consumer_id" }
  }'
```

Live at `https://gw.codespar.dev/market-data`.

### The analytics MCP tool

```bash
curl -sX POST https://api.codespar.dev/v1/mcp-servers \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "slug": "analytics-mcp",
    "name": "Analytics MCP",
    "upstream_url": "https://mcp.yourservice.com",
    "consumer_id": "your_consumer_id",
    "tools": [
      { "tool_name": "screen", "price": "0.02", "description": "Screen a ticker against your model" }
    ]
  }'
```

Live at `https://gw.codespar.dev/mcp/analytics-mcp`. In practice, call `POST /v1/mcp-servers/validate` against your real upstream first, so you price only the tools it actually exposes.

### The cart-checkout payment link

```bash
curl -sX POST https://api.codespar.dev/v1/payment-links \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "title": "Cart checkout",
    "accepts": [
      { "rail": "x402", "amount": "15.00", "pay_to": { "kind": "provisioned", "consumer_id": "your_consumer_id" } }
    ],
    "one_time": true,
    "max_uses": 1
  }'
```

Unlike the paywall and the MCP server above, `POST /v1/payment-links` takes no `slug`; the `201` response returns a server-generated one in `gateway_url`, e.g. `https://gw.codespar.dev/pay/a1b2c3`. Read it back off the response (`seller.mjs` does this for you).

Run all three in one shot with [`seller.mjs`](./seller.mjs).

## 2. Buyer: three mandates, one wallet

The [CodeSpar CLI](../../cli) pays each of the three under a governed mandate, a spending cap, and a receipt, the same signature model at every stop:

```bash
npm install -g @codespar/cli
codespar login

# One mandate per seller. Each cap matches what that seller charges, so this
# is a one-shot mandate; raise TOTAL_CAP to let it spend there more than once.
# --slot is CURRENCY:RAIL:TOTAL_CAP:PER_TX_CAP, in USDC atomic units (6 decimals).
codespar mandate create --consumer shopper --agent buyer \
  --payee https://gw.codespar.dev/market-data \
  --slot USDC:usdc:10000:10000

codespar mandate create --consumer shopper --agent buyer \
  --payee https://gw.codespar.dev/mcp/analytics-mcp \
  --slot USDC:usdc:20000:20000

codespar mandate create --consumer shopper --agent buyer \
  --payee https://gw.codespar.dev/pay/a1b2c3 \
  --slot USDC:usdc:15000000:15000000

# Spend against each mandate, one call per seller. An http(s) payee is routed
# to x402 (USDC on Base, settled on-chain); the CLI signs and settles for you.
codespar spend --mandate <mandate-id-1> --amount 10000 --agent buyer \
  --payee https://gw.codespar.dev/market-data
codespar spend --mandate <mandate-id-2> --amount 20000 --agent buyer \
  --payee https://gw.codespar.dev/mcp/analytics-mcp
codespar spend --mandate <mandate-id-3> --amount 15000000 --agent buyer \
  --payee https://gw.codespar.dev/pay/a1b2c3

# One wallet, three debits.
codespar wallet shopper
```

Run `codespar mandate create --help` and `codespar spend --help` for the exact flags; the CLI's own `--help` output is the source of truth, not this README. Three unrelated sellers, three caps, no bespoke integration on either side: the seller only ever implements one `POST` to create a resource, and the buyer only ever runs `mandate create` and `spend` against a URL.

## Run it end to end

[`seller.mjs`](./seller.mjs) creates the three resources above and writes their gateway URLs to `.cart.json`. [`buyer.mjs`](./buyer.mjs) reads that file and runs the CLI flow above, end to end.

```bash
cd use-cases/agent-shopping-cart
cp .env.example .env             # fill in CODESPAR_API_KEY and CONSUMER_ID
npm install
npm run seller                   # creates the paywall, the mcp-server, the payment link

npm install -g @codespar/cli && codespar login   # one time, if you haven't already
npm run buyer                    # three mandates, three spends, one wallet
```

`seller.mjs` needs real upstreams behind `UPSTREAM_API_URL` and `UPSTREAM_MCP_URL` to actually serve traffic; the defaults are placeholders, matching how [api-paywall](../../api-paywall)'s and [mcp-server](../../mcp-server)'s own examples point at `api.yourservice.com` and `mcp.yourservice.com` rather than a hosted stand-in.

## Files

- [`seller.mjs`](./seller.mjs) creates the paywall, the MCP server, and the payment link, and writes their gateway URLs to `.cart.json`.
- [`buyer.mjs`](./buyer.mjs) reads `.cart.json`, creates one mandate per seller, spends against each, and prints the wallet.

## Honesty

- The market-data paywall leg is production, settled on Base mainnet with real USDC, the same pipeline as [api-paywall](../../api-paywall).
- The MCP-server and payment-link legs are preview: built and tested, but not yet in the dashboard, and their APIs may still change. See the maturity table in the [root README](../../README.md).
- This example's payment link advertises USDC/x402 only. A payment link can also carry a Pix leg, but that leg is code-complete and does not move real BRL yet: it needs our banking partner's production credentials, which are not yet signed (see the [root README's Honesty section](../../README.md#honesty)). Nothing in this example touches Pix.
- `buyer.mjs` scrapes a mandate ID out of `codespar mandate create`'s stdout, because this repo does not pin the CLI's exact output format. Treat that parsing as a pattern to adapt, not a guaranteed contract; run `codespar mandate create --help` to check your installed version.
- A `csk_test_` key settles everything on Base Sepolia and can never touch mainnet; a `csk_live_` key settles the paywall leg for real, same as any other CodeSpar API paywall.
