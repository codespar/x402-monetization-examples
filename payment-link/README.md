# Payment link

**Maturity: preview. The x402 leg is built and tested; the Pix leg is code-complete but needs Celcoin production credentials to move real BRL. No create UI in the dashboard yet.**

A shareable, fixed-amount payment where the product is the payment itself: no upstream to proxy. One link can advertise more than one rail, priced independently (no FX), and closes after the first payment.

```
Agent or person  ──open link──▶  gw.codespar.dev/pay/<slug>  ──USDC or Pix──▶  Settle + receipt
```

## Create the link

```bash
curl -sX POST https://api.codespar.dev/v1/payment-links \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "title": "Report #42",
    "accepts": [
      { "rail": "x402", "amount": "0.05", "pay_to": { "kind": "provisioned", "consumer_id": "your_consumer_id" } },
      { "rail": "pix",  "amount": "5.00", "pix": { "key": "seller@pix.br" } }
    ],
    "one_time": true,
    "max_uses": 1,
    "expires_at": "2026-08-01T00:00:00Z",
    "redirect_url": "https://yourservice.com/thanks"
  }'
```

- One entry per rail. The `x402` amount is in USDC; the `pix` amount is in BRL. Each rail carries its own price; nothing is converted.
- `x402` `pay_to` is `{ "kind": "byo", "address": "0x..." }` or `{ "kind": "provisioned", "consumer_id": "..." }`. `pix` takes a `key` or a `celcoin_account`.
- The `201` response serves the link at `https://gw.codespar.dev/pay/<slug>`.

## How each rail settles

- **USDC:** the link answers `402` advertising the rails; the header carries the `exact`/USDC method. A USDC payer signs EIP-3009 and settles synchronously through the facilitator, and the response returns `{ paid, receipt_id, tx, network, redirect_url }`.
- **Pix:** a CodeSpar-native agent under a mandate (or a person with the QR) settles on `POST /pay/:slug/settle` with `{ mandate, signature }`. The mandate lifecycle runs the cap and allowlist checks and debits BRL to the link's Pix key.

A one-time link closes after the first successful payment; terminal states return a clean `409`/`410` rather than a fresh `402`.
