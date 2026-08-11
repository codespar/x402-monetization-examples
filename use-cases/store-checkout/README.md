# Store checkout: a real product, not a fractional-cent API call

**Maturity: preview, same as [payment link](../../payment-link). The USDC/x402 leg settles live on Base; the Pix leg on this same link is code-complete but needs our banking partner's production credentials to move real BRL.**

## The scenario

Aro is a Brazilian sneaker brand. It lists one real SKU, the Aro Runner, at full retail price: $89 in USDC or R$450 in Pix. It creates a single payment link that carries both rails side by side, no FX between them, and sets `max_uses: 1` so the link closes the moment one pair sells. The link is the checkout: there is no upstream API behind it, and nothing meters per request.

This is a useful example because it does not look like the other paywall examples in this repo. Those charge an agent a few cents per API call or per tool call, over and over, against a metered upstream. This one charges full price, once, for a physical, shippable good, and then the link is dead. It also puts a Pix rail on the exact same link as the x402 rail, so a Brazilian buyer with Pix and a USDC-paying agent can both buy the same shoe from the same URL, each at its own explicit price.

```
Buyer or agent  ──open link──▶  gw.codespar.dev/pay/<slug>  ──pay USDC (x402) or Pix──▶  settle + receipt
                                                              (max_uses spent, link closes)
```

## 1. Create the link (seller)

```bash
curl -sX POST https://api.codespar.dev/v1/payment-links \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "title": "Aro Runner sneaker",
    "accepts": [
      { "rail": "x402", "amount": "89.00", "pay_to": { "kind": "provisioned", "consumer_id": "your_consumer_id" } },
      { "rail": "pix",  "amount": "450.00", "pix": { "key": "loja@pix.br" } }
    ],
    "one_time": true,
    "max_uses": 1,
    "redirect_url": "https://yourstore.com/thanks"
  }'
```

Same shape as [payment-link](../../payment-link): one `accepts` entry per rail, each priced independently. `one_time: true` plus `max_uses: 1` is what makes this a single-unit sale instead of a reusable link; a second sale means creating a second link for the next pair in stock. The `201` response serves the checkout at `https://gw.codespar.dev/pay/<slug>`.

Runnable version: [`seller.mjs`](./seller.mjs).

## 2. Pay it (buyer)

A standard x402 client pays the USDC leg the same way [`buyer/pay.mjs`](../../buyer/pay.mjs) pays any x402 endpoint, because a payment link answers the same `402` handshake as a paywall:

```bash
cd use-cases/store-checkout
npm install
PRIVATE_KEY=0x... node buyer.mjs https://gw.codespar.dev/pay/<slug>
```

The client reads the `402`, signs an EIP-3009 authorization for `89.00` USDC, retries, and gets back the checkout result in the response body:

```json
{ "paid": true, "receipt_id": "rcpt_...", "tx": "0x...", "network": "eip155:8453", "redirect_url": "https://yourstore.com/thanks" }
```

A Pix payer would settle the other leg with a mandate against `POST /pay/:slug/settle`, per [payment-link](../../payment-link#how-each-rail-settles); `buyer.mjs` in this example only exercises the USDC leg, since that is the leg that actually moves money today.

Calling the same link again after the first sale does not sell a second pair. `max_uses: 1` is spent, so the gateway returns a clean `409`/`410` instead of a fresh `402`. `buyer.mjs` makes that second call and prints the status so you can see it.

## Files

- [`seller.mjs`](./seller.mjs) creates the two-rail, single-use link.
- [`buyer.mjs`](./buyer.mjs) pays the USDC leg and prints the receipt, then shows the second call getting refused.

## Honesty

- The USDC/x402 leg on this link settles the same way as the shipped payment-link example: EIP-3009 on Base, sandbox on a `csk_test_` key (Base Sepolia), mainnet on a `csk_live_` key.
- The Pix leg on this link is code-complete but needs our banking partner's production credentials to move real BRL. Nothing in this example moves real Reais today; do not represent it as a live Pix checkout.
- `payment-link` overall is preview: the API may still change, and there is no create UI in the dashboard yet.
