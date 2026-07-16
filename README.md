<p align="center">
  <h1 align="center">CodeSpar x402 Monetization Examples 💸</h1>
  <p align="center">
    <strong>Charge an AI agent to use your API, your MCP server, or a payment link, and settle in USDC over x402.</strong><br>
    <em>Public, copy-paste examples. Pix leg included for the LATAM lane.</em>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
    <img src="https://img.shields.io/badge/rail-x402%20on%20Base-0FA968.svg" alt="x402 on Base" />
  </p>
</p>

---

## The idea

An AI agent that wants your data, your tool, or your product should be able to pay for it in the same request, with no signup, no card, and no human in the loop. [x402](https://github.com/coinbase/x402) is the HTTP-native way to do that; CodeSpar is the seller side of it, plus a Pix leg for Latin America.

You create a resource once and get a URL on `gw.codespar.dev`. An agent that hits it unpaid gets an HTTP `402` with the price; it signs the payment, resends, and gets the resource. Every settlement seals a verifiable receipt.

## The shared spine (all three modes)

- **Create** through the API at `https://api.codespar.dev/v1/...` with your CodeSpar key (`csk_...`).
- **Agents pay** at `https://gw.codespar.dev/<your-slug>`.
- **Settlement** is USDC on Base (EIP-3009 `transferWithAuthorization`, so the payer is gasless). Each payment seals a hash-chained receipt.
- **No FX.** Each rail carries its own explicit price. A Pix leg is priced in BRL, a USDC leg in USDC, side by side.

Get a key at [codespar.dev](https://codespar.dev). Full docs at [docs.codespar.dev](https://docs.codespar.dev).

## Three ways to charge an agent

| Mode | You get | Best for | Maturity |
|---|---|---|---|
| **[API paywall](./api-paywall)** | `gw.codespar.dev/<slug>` in front of any HTTP API, charged per call | data APIs, any REST endpoint that charges per request | **Production**, settled on Base mainnet |
| **[MCP server](./mcp-server)** | `gw.codespar.dev/mcp/<slug>`, priced per tool | MCP servers, tool marketplaces, per-capability billing | Preview (backend live, no dashboard UI yet) |
| **[Payment link](./payment-link)** | `gw.codespar.dev/pay/<slug>`, a fixed-amount link in USDC or Pix | checkouts, credit packs, one-off purchases | Preview (Pix leg needs Celcoin production creds) |

All three settle through the same pipeline and seal the same receipt. A seller picks the shape that fits.

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
- The Pix leg on payment links is code-complete but needs Celcoin production credentials to move real BRL.

## Related

- [Awesome Agentic Commerce LATAM](https://github.com/codespar/awesome-agentic-commerce-latam) - the ecosystem index.
- [MCP Dev LATAM](https://github.com/codespar/mcp-dev-latam) - 127 MCP servers for LATAM commerce.

## License

[MIT](LICENSE).
