# Cross-border agent mandate

**Maturity: preview. The USDC leg inherits [mcp-server](../../mcp-server)'s preview status; the Pix leg inherits [payment-link](../../payment-link)'s preview status and does not move real BRL. See Honesty below.**

Two unrelated sellers, two unrelated products, one buyer. Seller A sells API access to an AI agent as a priced MCP tool: a `translate` call at 0.03 USDC. Seller B is a Brazilian business that only takes Pix, selling a R$35.00 translated report as a payment link. The buyer holds one CodeSpar mandate with two slots, a USDC cap and a BRL/Pix cap, both under the same signature. In one script run, the buyer's agent pays the MCP tool in USDC and the payment link in Pix, back to back, then prints both settlement receipts side by side.

```
Seller A (MCP tool)   POST /v1/mcp-servers    ──▶ gw.codespar.dev/mcp/translate-mcp   (0.03 USDC/call)
Seller B (Pix link)   POST /v1/payment-links  ──▶ gw.codespar.dev/pay/<slug>          (R$35.00, Pix only)

Buyer   codespar mandate create --slot USDC:usdc:... --slot BRL:pix:...   one mandate, two slots
Buyer   codespar spend  ──▶ MCP payee    USDC leg, settles on Base
Buyer   codespar spend  ──▶ Pix payee    Pix leg, settles via Celcoin once production credentials are live
Buyer   codespar wallet                  both slots printed side by side, no FX
```

This is the worked-out version of the line already in [cli/README.md](../../cli/README.md): "the same mandate pays a US API in USDC and a Brazilian store in Pix under one signature." Here the "US API" is a priced MCP tool instead of a paywall, and the "Brazilian store" is a Pix-only payment link.

## What it busts

The assumption this kills: that a Pix leg for a LATAM seller is a sandbox afterthought bolted onto a real, USDC-only rail. It isn't a second stack glued to the first. One mandate governs both legs identically, same cap-and-allowlist checks, same receipt pipeline, whichever currency is moving. What's still true, and stated plainly below, is that the Pix leg's real-money settlement is not live yet; the governance and the wiring are the same wiring, the money isn't flowing in BRL yet.

## Seller side: two payees

### 1. Price a tool on the MCP server (the USDC leg)

```bash
curl -sX POST https://api.codespar.dev/v1/mcp-servers \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "slug": "translate-mcp",
    "name": "Translate MCP",
    "upstream_url": "https://mcp.yourservice.com",
    "consumer_id": "your_consumer_id",
    "tools": [
      { "tool_name": "translate", "price": "0.03", "description": "Translate text between languages" }
    ]
  }'
```

Same shape as [mcp-server](../../mcp-server): `price` is a decimal USDC string, `consumer_id` is the provisioned wallet that receives it, and unpriced tools on the same server still proxy free. You get `https://gw.codespar.dev/mcp/translate-mcp`.

### 2. Create a Pix-only payment link (the Pix leg)

```bash
curl -sX POST https://api.codespar.dev/v1/payment-links \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "title": "Report translation (PT-BR)",
    "accepts": [
      { "rail": "pix", "amount": "35.00", "pix": { "key": "seller@pix.br" } }
    ],
    "one_time": true,
    "max_uses": 1
  }'
```

Same shape as [payment-link](../../payment-link), just with a single `pix` entry in `accepts` instead of one per rail; this seller never sees USDC. `amount` is a decimal BRL string. The `201` response serves the link at `https://gw.codespar.dev/pay/<slug>`.

## Buyer side: one mandate, two slots

```bash
npm install -g @codespar/cli
codespar login

# One mandate, two payees, two slots. --slot is CURRENCY:RAIL:TOTAL_CAP:PER_TX_CAP,
# in each currency's minor units (USDC has 6 decimals; BRL here uses 2, i.e. cents).
codespar mandate create --consumer shopper --agent buyer \
  --payee https://gw.codespar.dev/mcp/translate-mcp \
  --payee https://gw.codespar.dev/pay/report-pt-br \
  --slot USDC:usdc:1000000:50000 \
  --slot BRL:pix:100000:5000

# Pay the MCP tool: 0.03 USDC = 30000 atomic units.
codespar spend --mandate <mandate-id> --amount 30000 --agent buyer \
  --payee https://gw.codespar.dev/mcp/translate-mcp

# Pay the payment link: R$35.00 = 3500 minor units.
codespar spend --mandate <mandate-id> --amount 3500 --agent buyer \
  --payee https://gw.codespar.dev/pay/report-pt-br

# Both slots, side by side.
codespar wallet shopper
```

Run `codespar mandate create --help` and `codespar spend --help` for the exact flags and each currency's minor-unit convention; the CLI's own `--help` output is the source of truth, not this README.

## Run it end to end

[`seller.mjs`](./seller.mjs) creates both payees; [`buyer.mjs`](./buyer.mjs) shells out to the commands above and prints the wallet at the end.

```bash
cd use-cases/cross-border-agent-mandate
cp .env.example .env    # fill in CODESPAR_API_KEY, CODESPAR_CONSUMER_ID, UPSTREAM_MCP_URL
npm install
npm run seller           # prints the two gateway URLs

npm install -g @codespar/cli && codespar login   # one time, if you haven't already

MCP_GATEWAY_URL=https://gw.codespar.dev/mcp/translate-mcp \
PAYMENT_LINK_URL=https://gw.codespar.dev/pay/<slug-from-seller.mjs> \
  npm run buyer
```

`seller.mjs` needs a real upstream MCP server behind `UPSTREAM_MCP_URL` that implements a `translate` tool; there is no public one wired up here, matching how [mcp-server](../../mcp-server)'s own examples point at `https://mcp.yourservice.com` rather than a hosted stand-in.

## Honesty

- A `csk_test_` key settles the USDC leg on Base Sepolia by construction and can never touch mainnet, same as everywhere else in this repo.
- The MCP-server surface (the USDC leg here) is built and tested but not yet in the dashboard, and its API may still change; treat it as preview, same as [mcp-server](../../mcp-server).
- The Pix leg here is code-complete but needs Celcoin production credentials to move real BRL, same as [payment-link](../../payment-link). Running this example does not move real BRL; the USDC leg can settle for real on Base with a `csk_live_` key, the Pix leg cannot yet settle for real anywhere.
