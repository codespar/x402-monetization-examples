# Full-price diligence API

**Maturity: production, settled on Base mainnet. Same pipeline as [../../api-paywall](../../api-paywall); only the slug, upstream, and price differ.**

## What this busts

A common assumption about x402 is that it only works for micropayments, fractions of a cent, the kind of pricing that only makes sense for an AI agent nickel-and-diming an API. It doesn't hold: the `price` field on a CodeSpar paywall is a decimal USDC string with a documented $0.01 floor (see [../../api-paywall/README.md](../../api-paywall/README.md)) and no ceiling. Nothing about the mechanism changes above a dollar. This example prices a single call at $85.00 to show it: one paid `GET`, one substantive deliverable, settled the same way as a one-cent call.

## The scenario

A due-diligence data provider sells company ownership-structure reports: who owns what, through which entities, sourced and assembled per request. Each report is a real cost to produce and a real deliverable to the buyer, so it is priced like one: $85.00 in USDC, per report, no subscription, no free tier, no cents-level trickle pricing. An agent (or a person's agent, doing KYB/KYC work) pays once and gets the report.

## 1. Create the paywall (seller side)

The exact `POST /v1/paywalls` call from [../../api-paywall/README.md](../../api-paywall/README.md), pointed at the report generator and priced at $85:

```bash
curl -sX POST https://api.codespar.dev/v1/paywalls \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "slug": "company-diligence-report",
    "name": "Company ownership-structure report",
    "upstream_url": "https://api.yourservice.com/reports/company",
    "price": "85.00",
    "currency": "USDC",
    "payto": { "kind": "provisioned", "consumer_id": "your_consumer_id" }
  }'
```

Or run it as a script, [`seller.mjs`](./seller.mjs):

```bash
cp .env.example .env   # fill in CODESPAR_API_KEY, CODESPAR_CONSUMER_ID, UPSTREAM_URL
npm run create
```

The `201` response includes `gateway_url`: `https://gw.codespar.dev/company-diligence-report`. `upstream_url` in this example is a placeholder; point it at your own report generator, and any auth it needs is stored server-side and injected on proxy, never exposed to the caller.

## 2. What an unpaid agent sees

A `GET` with no payment gets an HTTP `402`. Decoded from `PAYMENT-REQUIRED`:

```json
{
  "x402Version": 2,
  "error": "payment required",
  "resource": { "url": "https://gw.codespar.dev/company-diligence-report", "mimeType": "application/json" },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:8453",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "85000000",
    "payTo": "0x...",
    "maxTimeoutSeconds": 120,
    "extra": { "name": "USD Coin", "version": "2" }
  }]
}
```

`amount` is `85000000` atomic USDC (six decimals), which is `$85.00`. Same field, same six decimals, same shape as the `$0.01` example in the api-paywall README; only the number changed.

## 3. Pay it (buyer side)

The repo's standard buyer script pays it unmodified: [`buyer/pay.mjs`](../../buyer/pay.mjs).

```bash
cd ../../buyer && npm install
PRIVATE_KEY=0x... node pay.mjs https://gw.codespar.dev/company-diligence-report
```

The wrapped `fetch` reads the `402`, signs one EIP-3009 authorization for `85000000` atomic USDC, resends with `PAYMENT-SIGNATURE`, and returns the report. One call, one signature, one settlement. No recurring charge, no partial units, no trickle.

Test the flow against a `csk_test_` paywall on Base Sepolia first (fund the buyer wallet from a faucet, see [../../buyer/README.md](../../buyer/README.md)) before creating this at `csk_live_` and moving a real $85.

## Honesty

- Production, settled on Base mainnet. This is the same api-paywall pipeline as [../../api-paywall](../../api-paywall), proven at that maturity; only the slug, upstream, and price differ here, which is the point.
- `upstream_url` above is a placeholder. Swap it for your own report generator before this does anything real.
- This example has no Pix leg (it's an api-paywall, not a payment link), so there is nothing here to overclaim on BRL settlement.
