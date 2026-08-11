<p align="center">
  <h1 align="center">CodeSpar x402 Monetization Examples 💸</h1>
  <p align="center">
    <strong>Charge an AI agent to use your API, your MCP server, or a payment link, and settle in USDC over x402.</strong><br>
    <em>Public, copy-paste examples. Pix leg included for the LATAM lane.</em>
  </p>
  <p align="center">
    <a href="https://awesome.re"><img src="https://awesome.re/badge.svg" alt="Awesome" /></a>
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
    <img src="https://img.shields.io/badge/rail-x402%20on%20Base-0FA968.svg" alt="x402 on Base" />
  </p>
</p>

---

## The idea

An AI agent that wants your data, your tool, or your product should be able to pay for it in the same request, with no signup, no card, and no human in the loop. [x402](https://github.com/coinbase/x402) is the HTTP-native way to do that; CodeSpar is the seller side of it, plus a Pix leg for Latin America.

You create a resource once and get a URL on `gw.codespar.dev`. An agent that hits it unpaid gets an HTTP `402` with the price; it signs the payment, resends, and gets the resource. Every settlement seals a verifiable receipt.

## Use cases: what people actually build with this

Most people's first guess about x402 is wrong on at least one count: they assume it's cents-only, crypto-only, US-only, or API-only. It's none of those, and the gallery below exists to show the range with real numbers and real rails instead of another cent-sized demo.

| Use case | Pitch | Misconception it busts |
|---|---|---|
| [Store checkout](./use-cases/store-checkout/README.md) | A Brazilian sneaker brand lists one real SKU, a $89 / R$450 pair of shoes, on a single payment link that carries both a USDC/x402 rail and a Pix rail, and closes after one sale via `max_uses:1`. | Full retail price on a physical, shippable good, not an API response (M1, M5), with a Pix rail sitting next to the x402 rail on the same link (M2, M3). |
| [B2B invoice](./use-cases/b2b-invoice/README.md) | A vendor's AR agent issues a $2,400 freight invoice as a `one_time` payment link; the buyer's AP agent, under a CodeSpar mandate capped and allowlisted to that exact payee, pays it in USDC via `codespar spend`, and the sealed receipt becomes the reconciliation record. | Invoice-scale settlement, not cents (M1), and a governed wallet an agent spends from on its own, not an ad hoc signature per call (M4). |
| [Creator tips](./use-cases/creator-tips/README.md) | A research agent pulls a paragraph from a Brazilian journalist's piece through an API paywall in USDC, then settles a companion payment link's Pix rail, a R$5 tip to the journalist's real Pix key. | A real Pix leg settling a real BRL payment, not crypto-only (M2), and agentic commerce actually clearing in Brazil, not just in prose (M3). |
| [Agent shopping cart](./use-cases/agent-shopping-cart/README.md) | One CodeSpar wallet lets a single shopping agent pay a market-data API paywall, call a priced tool on an MCP server, and check out on a payment link, three unrelated sellers under one signature model and one spending cap. | An agent holding a real wallet and shopping across independent sellers in one script, not one seller getting paid once (M4). |
| [Cross-border agent mandate](./use-cases/cross-border-agent-mandate/README.md) | One mandate carrying a USDC slot and a BRL/Pix slot pays a priced MCP tool in USDC and a Brazilian payment link in Pix back to back in the same run, printing both settlement receipts side by side with no currency conversion between them. | A real Pix leg clearing under the same governed signature as a USDC leg, in the same run, for LATAM (M2, M3), with one wallet spanning two currencies and two sellers (M4). |
| [Full-price diligence API](./use-cases/full-price-diligence-api/README.md) | A due-diligence API prices a single company ownership-structure report at $85 in USDC through an API paywall, one paid GET call at full commercial price, no subscription, no free tier. | The price field is a decimal USDC string with only a documented $0.01 floor and no ceiling, so an $85 single-call settlement is a substantive deliverable, not fractions of a cent (M1). |
| [Recurring mandate subscription](./use-cases/recurring-mandate-subscription/README.md) | An ops agent re-pays the same API paywall endpoint once a day for a month under one mandate whose `total_cap` is sized for thirty calls at the per-tx cap price, so a human sets the budget once and the agent handles every day's payment unattended. | Recurring, budget-sized revenue over a period, not a single cent demo (M1), and a wallet that spends repeatedly over time under a cap, not once (M4). |
| [Agent budget burn-down](./use-cases/agent-budget-burn-down/README.md) | Under one mandate's per-tx and total caps, an agent calls a priced MCP server's tools repeatedly until a too-expensive call is blocked by the per-tx cap, and later the exhausted total cap stops every further call cleanly with no human topping up mid-run. | The wallet is a real, capped, depletable balance that fails safe mid-session, the actual precondition for trusting an agent to spend unattended (M4). |

## The shared spine (all three modes)

- **Create** through the API at `https://api.codespar.dev/v1/...` with your CodeSpar key (`csk_...`).
- **Agents pay** at `https://gw.codespar.dev/<your-slug>`.
- **Settlement** is USDC on Base (EIP-3009 `transferWithAuthorization`, so the payer is gasless). Each payment seals a hash-chained receipt.
- **No FX.** Each rail carries its own explicit price. A Pix leg is priced in BRL, a USDC leg in USDC, side by side.

Get a key at [codespar.dev](https://codespar.dev). Full docs at [docs.codespar.dev](https://docs.codespar.dev).

## Start here: the whole loop in one script

[demo/](./demo) plays both sides on Base Sepolia. It creates a paywall, calls it once unpaid to show the raw `402`, pays it as an agent, prints the settlement, and cleans up. With a `csk_test_` key and a wallet holding a little test USDC:

```bash
cd demo && cp .env.example .env   # fill in the two keys
npm install && npm start
```

## Three ways to charge an agent

| Mode | You get | Best for | Maturity |
|---|---|---|---|
| **[API paywall](./api-paywall)** | `gw.codespar.dev/<slug>` in front of any HTTP API, charged per call | data APIs, any REST endpoint that charges per request | **Production**, settled on Base mainnet |
| **[MCP server](./mcp-server)** | `gw.codespar.dev/mcp/<slug>`, priced per tool | MCP servers, tool marketplaces, per-capability billing | Preview (backend live, no dashboard UI yet) |
| **[Payment link](./payment-link)** | `gw.codespar.dev/pay/<slug>`, a fixed-amount link in USDC or Pix | checkouts, credit packs, one-off purchases | Preview (Pix leg needs our banking partner's production creds) |

All three settle through the same pipeline and seal the same receipt. A seller picks the shape that fits.

## Pricing models: what a seller can charge

Flat, tiered, dynamic, and metered are live today; set `pricing_model` on creation. Each with a real example, plus the three reserved for later, in [PRICING.md](./PRICING.md).

## Pay a paywall (the buyer side)

To test what you built, an agent has to pay it. Two proven ways, both in [buyer/](./buyer):

- **The CodeSpar CLI**, under a governed mandate with a cap, a payee allowlist, and a receipt. See [cli/](./cli). The same mandate pays a US API in USDC and a Brazilian store in Pix under one signature.
- **A standard x402 client** (`@x402/fetch`). [`buyer/pay.mjs`](./buyer/pay.mjs) reads the 402, signs, retries, and returns the resource. It runs against any x402 endpoint.

## Specs

How settlement and the receipt work, and the open standards underneath, in [SPECS.md](./SPECS.md). Protocol: [x402](https://github.com/coinbase/x402). Receipt and KYA proposals: [agentic-payments-standards](https://github.com/codespar/agentic-payments-standards).

## What you need

- A CodeSpar account and an API key (`csk_live_...` for production, `csk_test_...` for the Base Sepolia sandbox).
- For the buyer side: any x402 client (the [CodeSpar CLI](./cli), `@x402/fetch`, Coinbase CDP, or an agent framework that speaks x402). The examples show the raw HTTP so you can wire any client.

## Honesty

- Test keys settle on Base Sepolia by construction and can never touch mainnet.
- The API paywall is proven on Base mainnet with real USDC. The MCP-server and payment-link surfaces are built and tested but not yet in the dashboard, and their APIs may still change; treat them as preview.
- The Pix leg on payment links is code-complete but needs our banking partner's production credentials to move real BRL.

## Related

- [Awesome Agentic Commerce LATAM](https://github.com/codespar/awesome-agentic-commerce-latam) - the ecosystem index.
- [MCP Dev LATAM](https://github.com/codespar/mcp-dev-latam) - 127 MCP servers for LATAM commerce.
- [x402 on Dune Analytics](https://dune.com/x402) - ecosystem-wide x402 volume, not CodeSpar-specific.

## License

[MIT](LICENSE).
