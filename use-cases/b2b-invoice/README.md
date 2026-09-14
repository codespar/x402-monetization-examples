# B2B invoice payment

**Maturity: the x402/USDC settlement underneath is the same production pipeline [api-paywall](../../api-paywall) is proven on. The invoice itself is created as a [payment-link](../../payment-link), which is preview (API may still change, no create UI in the dashboard yet). The buyer side runs the [CodeSpar CLI](../../cli)'s mandate/spend path. This link carries no Pix rail, so there is nothing here to overclaim on BRL settlement.**

## What this busts

Two assumptions at once. First, that x402 is a micropayments toy: the api-paywall examples in this repo mostly charge cents per call, so it's easy to conclude the rail only works at that scale. It doesn't; the price field is just a decimal string, and this example prices one payment at $2,400.00, an invoice, not a nickel-and-dime. Second, that an agent paying on its own means an agent holding a raw private key or a fresh signature per call, with no limit on what it could sign next. It doesn't have to: the CodeSpar CLI's mandate is created once, capped at an exact amount, and allowlisted to an exact payee, before the agent ever spends. The agent that pays this invoice cannot pay any other amount to any other address under this mandate.

## The scenario

A freight vendor's AR agent has a $2,400 invoice to collect, invoice #4471. It creates one CodeSpar payment link for it: a single USDC/x402 entry at `"2400.00"`, `one_time: true`, so the link is good for exactly one payment and then closes.

The buyer's AP agent already holds a CodeSpar mandate scoped in advance for exactly this kind of payment: a slot capped at $2,400 USDC and allowlisted to this invoice's URL. It spends against that mandate to pay the link. Settlement is the same EIP-3009 USDC-on-Base handshake as every other example in this repo; the difference is who signs. Nobody hand-authorizes a wire, nobody re-types the invoice into a payment portal, and no human touches either company's accounting system. What lands on the buyer's side is a sealed receipt binding the mandate, the payee, and the settlement, and that receipt is the reconciliation record, not an entry pushed into either ledger.

```
AR agent   ──POST /v1/payment-links──▶  gw.codespar.dev/pay/<slug>   (one_time, $2,400.00 USDC)
AP agent   ──codespar mandate create──▶  mandate: cap $2,400, payee = that exact URL
AP agent   ──codespar spend──▶  gw.codespar.dev/pay/<slug>  ──x402/USDC on Base──▶  settle + sealed receipt
```

## 1. Issue the invoice (seller / AR side)

The exact `POST /v1/payment-links` shape from [payment-link/README.md](../../payment-link/README.md), with a single rail and the invoice amount:

```bash
curl -sX POST https://api.codespar.dev/v1/payment-links \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "title": "Freight invoice #4471",
    "accepts": [
      { "rail": "x402", "amount": "2400.00", "pay_to": { "kind": "provisioned", "consumer_id": "your_consumer_id" } }
    ],
    "one_time": true,
    "max_uses": 1
  }'
```

The create sends no `slug`, so CodeSpar assigns one and the `201` response carries the invoice URL in `pay_url`, `https://gw.codespar.dev/pay/<slug>`. "4471" is the invoice number, not the slug: the URL only exists on the response, and a slug the server did not issue answers `404 payment_link_not_found`. One rail, one entry: no Pix leg on this link, nothing to convert, nothing to overclaim. `one_time: true` plus `max_uses: 1` close the link on the first successful payment, the same as any other CodeSpar payment link.

Runnable version: [`seller.mjs`](./seller.mjs).

```bash
CODESPAR_API_KEY=csk_test_... CONSUMER_ID=your_consumer_id node seller.mjs
```

## 2. Pay it (buyer / AP side)

This is the CLI mandate/spend path from [cli/README.md](../../cli/README.md), not a raw x402 client: the agent spends from a mandate that was scoped before this invoice ever existed, rather than signing a fresh authorization on the spot.

```bash
npm install -g @codespar/cli
codespar login

# 1. A mandate capped at exactly $2,400 USDC and allowlisted to this invoice's link.
#    --slot is CURRENCY:RAIL:TOTAL_CAP:PER_TX_CAP, in USDC atomic units (6 decimals).
PAYEE_URL=<the pay_url seller.mjs printed>

codespar mandate create --consumer buyerco --agent payer \
  --payee "$PAYEE_URL" \
  --slot USDC:usdc:2400000000:2400000000

# 2. Spend it. An http(s) payee routes to x402 (USDC on Base, settled on-chain);
#    the CLI signs and settles the authorization for you.
codespar spend --mandate <mandate-id> --amount 2400000000 --agent payer \
  --payee "$PAYEE_URL"

# 3. The wallet: the USDC slot now debited by $2,400, and the sealed receipt.
codespar wallet buyerco
```

`2400000000` atomic units is `$2,400.00` (USDC has 6 decimals). Because the mandate's total cap and per-transaction cap are both set to the exact invoice amount, and the payee allowlist is this one URL, the mandate can pay this invoice and nothing else, once. Run `codespar mandate create --help` and `codespar spend --help` for the exact flags.

Runnable version: [`buyer.sh`](./buyer.sh).

`PAYEE_URL` is required: it is the `pay_url` step 1 printed. There is no default, because a guessed slug is a link that does not exist.

```bash
PAYEE_URL=<pay_url from step 1> ./buyer.sh
PAYEE_URL=<pay_url from step 1> MANDATE_ID=<mandate-id-from-step-1> ./buyer.sh
```

## Files

- [`seller.mjs`](./seller.mjs) creates the one-time, single-rail invoice link.
- [`buyer.sh`](./buyer.sh) creates the capped, allowlisted mandate, then spends it and shows the wallet.

## Honesty

- The USDC/x402 settlement itself, EIP-3009 on Base, is the same production pipeline [api-paywall](../../api-paywall) is proven on: sandbox on a `csk_test_` key (Base Sepolia), mainnet on a `csk_live_` key. Test on Sepolia before pointing a live mandate at a `csk_live_` invoice link.
- The invoice is created as a [payment-link](../../payment-link), which is preview: the API may still change and there is no create UI in the dashboard yet.
- The mandate and spend commands are the governed path documented in [cli/README.md](../../cli/README.md). The cap and allowlist are enforced before the spend, and settlement seals a receipt binding the mandate, the payee, and the payment. That receipt is proof the payment was authorized and delivered, it is not a ledger integration: nothing here reads from or writes to either company's accounting system, and matching the receipt to invoice #4471 in your AP or AR books is a step you still have to build.
- This link has no Pix rail, so this example does not move, or claim to move, any BRL. Pix on payment links generally is code-complete but still needs our banking partner's production credentials before it moves real BRL; see [payment-link](../../payment-link) and the top-level [README](../../README.md#honesty).
