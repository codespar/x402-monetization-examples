# Creator tips: an agent pays for the excerpt, then tips the journalist in Pix

**Maturity: mixed. The USDC excerpt call runs on the same production pipeline as the API paywall. The Pix tip is preview: code-complete, gated on our banking partner's production credentials.**

A research agent needs one paragraph from a Brazilian journalist's piece. It calls her article API, pays $0.02 in USDC over x402, and gets the excerpt with no signup and no human approving the request. Then it settles a companion payment link's Pix leg: a R$5.00 tip to her real Pix key, `journalist@pix.br`. The journalist is paid in BRL. The payer is an autonomous agent, not a person with a bank app.

That combination is the point of this example, against two common doubts:

- **"Pix only moves when a person taps a QR code."** Here the Pix leg settles under a signed mandate, initiated by the agent, with no human in the loop on the payer side.
- **"Agentic commerce is a US-crypto-only story; it doesn't clear in Brazil."** The same request pays a US-style API in USDC and a Brazilian creator in BRL, side by side, on two rails that settle independently with no FX between them.

Two resources, two rails, one paragraph:

```
Agent  ──pays $0.02 USDC──▶  gw.codespar.dev/journalist-article  ──excerpt──▶  Agent
Agent  ──settles R$5.00 Pix──▶  gw.codespar.dev/pay/<tip-slug>  ──receipt──▶  Journalist's Pix key
```

## Seller: two resources

The journalist (or her publisher) creates both up front. Nothing here differs from the shapes in [`../../api-paywall`](../../api-paywall) and [`../../payment-link`](../../payment-link); this example just points them at the same creator.

### 1. The article API, behind a paywall

```bash
curl -sX POST https://api.codespar.dev/v1/paywalls \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "slug": "journalist-article",
    "name": "Journalist article API",
    "upstream_url": "https://api.yourpublication.com/articles/latest",
    "price": "0.02",
    "currency": "USDC",
    "payto": { "kind": "provisioned", "consumer_id": "your_consumer_id" }
  }'
```

### 2. The tip link, a single Pix entry

```bash
curl -sX POST https://api.codespar.dev/v1/payment-links \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "title": "Tip the journalist",
    "accepts": [
      { "rail": "pix", "amount": "5.00", "pix": { "key": "journalist@pix.br" } }
    ]
  }'
```

One rail on this link, not two: no USDC entry, because the tip is meant to land in the journalist's own Pix key, in BRL, regardless of what currency paid for the article. `POST /v1/paywalls` requires the `slug` you choose; `POST /v1/payment-links` does not take one and returns a server-generated slug in the `201` response, so read it back off the response (`seller.mjs` prints the raw JSON for exactly this reason).

Run both in one shot with [`seller.mjs`](./seller.mjs).

## Buyer: the agent, two legs under one script

[`buyer.mjs`](./buyer.mjs) is a standard `@x402/fetch` client, the same pattern as [`../../buyer/pay.mjs`](../../buyer/pay.mjs), plus one raw call for the Pix leg.

1. **Pull the excerpt.** The wrapped `fetch` reads the paywall's `402`, signs an EIP-3009 authorization for $0.02 USDC, retries, and returns the article text. This is the proven, production path, identical to any other API paywall in this repo.
2. **Settle the tip.** Per [`../../payment-link/README.md`](../../payment-link/README.md#how-each-rail-settles), the Pix leg of a payment link settles on `POST /pay/:slug/settle` with `{ mandate, signature }`. The mandate carries a `BRL:pix` slot, exactly as documented in [`../../cli/README.md`](../../cli/README.md):

   ```bash
   codespar mandate create --consumer research-agent --agent tipper \
     --payee https://gw.codespar.dev/pay/<tip-slug> \
     --slot BRL:pix:50000:500
   ```

   That command (or however else your agent's mandate gets signed) is what produces the `mandate` and `signature` values. `buyer.mjs` does not construct or sign a mandate itself; it treats both as opaque values it was handed, and posts them straight to `/pay/:slug/settle`, exactly as the payment-link README documents. This example does not reimplement the CLI's signing step.

## Run it

```bash
cd use-cases/creator-tips
cp .env.example .env    # fill in CODESPAR_API_KEY, the upstream, the Pix key
npm install

# Seller: create the paywall and the tip link.
node seller.mjs

# Buyer: pull the excerpt in USDC, then (optionally) settle the tip in Pix.
PRIVATE_KEY=0x... node buyer.mjs
```

`buyer.mjs` runs the USDC leg unconditionally; it needs `PRIVATE_KEY` (a funded Base wallet, Sepolia first) same as `pay.mjs`. The Pix leg runs only if `MANDATE` and `MANDATE_SIGNATURE` are set, since that pair comes from a signed mandate you produce separately, not from this script.

## Honesty

- The USDC excerpt call is the proven path: same pipeline as the production API paywall, settled on Base.
- The Pix tip is code-complete but does not move real BRL yet. Per the repo's [Honesty section](../../README.md#honesty): "The Pix leg on payment links is code-complete but needs our banking partner's production credentials to move real BRL." Running `buyer.mjs` end to end today settles the excerpt live and exercises the real `/pay/:slug/settle` request shape for the tip, but the tip itself does not land in the journalist's Pix account until those credentials are signed.
- Test everything on a `csk_test_` key and Base Sepolia before pointing `CODESPAR_API_KEY` or `PRIVATE_KEY` at anything real.
