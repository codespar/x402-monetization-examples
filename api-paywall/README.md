# API paywall

**Maturity: production, settled on Base mainnet.**

Put a paywall in front of any HTTP API. The agent pays per call in USDC over x402 before the request reaches your backend. Private upstream headers stay server-side; the agent never sees them.

```
Agent  ──GET /<slug>──▶  gw.codespar.dev  ──402 (unpaid)──▶  Agent
Agent  ──pays x402───▶   gw.codespar.dev  ──settle+proxy──▶  Your API  ──response──▶ Agent
```

## 1. Create the paywall

```bash
curl -sX POST https://api.codespar.dev/v1/paywalls \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "slug": "market-data",
    "name": "Market data API",
    "upstream_url": "https://api.yourservice.com",
    "price": "0.01",
    "currency": "USDC",
    "payto": { "kind": "provisioned", "consumer_id": "your_consumer_id" }
  }'
```

- `price` is a decimal USDC string (up to 6 decimals). Minimum is `$0.01`.
- `upstream_url` is where paid calls are proxied. Add any auth your upstream needs; it is stored server-side and injected on proxy, never exposed to the caller.
- `payto`: `{ "kind": "byo", "address": "0x..." }` to receive USDC at your own address, or `{ "kind": "provisioned", "consumer_id": "..." }` to receive into a CodeSpar-provisioned wallet (the same balance your buy-side agent spends from).

The `201` response includes `gateway_url`, e.g. `https://gw.codespar.dev/market-data`. Manage it with `GET/PATCH/DELETE /v1/paywalls/:id`, and see earnings with `GET /v1/paywalls/:id/stats`.

## 2. What the agent sees when unpaid

A call with no payment gets an HTTP `402`. The x402 challenge rides in the base64 `PAYMENT-REQUIRED` header (v2 clients read the header; the body is a human-readable mirror). Decoded:

```json
{
  "x402Version": 2,
  "error": "payment required",
  "resource": { "url": "https://gw.codespar.dev/market-data", "mimeType": "application/json" },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:8453",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "10000",
    "payTo": "0x...",
    "maxTimeoutSeconds": 120,
    "extra": { "name": "USD Coin", "version": "2" }
  }]
}
```

`amount` is the price in USDC atomic units (6 decimals, so `10000` = `$0.01`). On a `csk_test_` key the network is `eip155:84532` (Base Sepolia).

## 3. Pay and get the resource

Any x402 client signs an EIP-3009 authorization for the advertised amount and resends with a `PAYMENT-SIGNATURE` header. The gateway verifies, settles on Base, proxies your upstream, and echoes the settlement (tx hash, network, payer) in `PAYMENT-RESPONSE`.

The simplest path is to let a client library do the signing:

```bash
# The raw 402 (inspect the terms)
curl -i https://gw.codespar.dev/market-data

# In practice, wrap fetch with an x402 client so the sign-and-retry is automatic:
#   Coinbase CDP, or @x402/fetch, or any agent framework that speaks x402 v2.
```

Notes:
- A repeat of the same signed authorization re-delivers the resource without charging again (idempotent), so a dropped response is safe to retry.
- A paywall charges per access; there is no session and no order.
