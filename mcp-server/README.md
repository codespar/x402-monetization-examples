# MCP server monetization

**Maturity: preview. Backend and gateway are built and tested; there is no dashboard UI yet and the API may change.**

An MCP server is not a paywall, because pricing is per tool, not per endpoint. You register an upstream MCP server, price each tool, and get one gateway URL. The gateway proxies MCP JSON-RPC and charges only on a priced `tools/call`. Discovery (`initialize`, `tools/list`) stays free, so an agent can see what it can buy before it pays.

```
Agent  ──tools/list──▶  gw.codespar.dev/mcp/<slug>  ──free──▶  Upstream MCP  (agent sees the menu)
Agent  ──tools/call──▶  gw.codespar.dev/mcp/<slug>  ──settle──▶ Upstream MCP  (only priced tools charge)
```

## 1. Discover the tools to price

```bash
curl -sX POST https://api.codespar.dev/v1/mcp-servers/validate \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{ "upstream_url": "https://mcp.yourservice.com" }'
```

This connects to your upstream and lists its tools, so you can price what it actually exposes.

## 2. Register and price per tool

```bash
curl -sX POST https://api.codespar.dev/v1/mcp-servers \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "slug": "weather-mcp",
    "name": "Weather MCP",
    "upstream_url": "https://mcp.yourservice.com",
    "consumer_id": "your_consumer_id",
    "upstream_auth": { "header": "authorization", "value": "Bearer ..." },
    "tools": [
      { "tool_name": "forecast", "price": "0.02", "description": "7-day forecast" },
      { "tool_name": "history",  "price": "0.05", "description": "historical data" }
    ]
  }'
```

- Price per tool as a decimal USDC string. Unpriced tools proxy free.
- `upstream_auth` is stored server-side and injected on proxy; the agent never sees it.
- Re-price a tool with `PATCH /v1/mcp-servers/:id/tools/:tool`.

You get `https://gw.codespar.dev/mcp/weather-mcp`.

## 3. How a priced tool call charges

On a priced `tools/call`, the gateway accepts two payment modes on the same interception point:

- **Native CodeSpar agent:** a signed mandate in the `X-CODESPAR-PAYMENT` header. Best UX for an agent that already holds a CodeSpar mandate; no interactive challenge, and it is the Pix analog on the buy side.
- **Any x402 agent:** an EIP-3009 authorization in `PAYMENT-SIGNATURE`. Same settlement pipeline as the API paywall.

With no proof of payment, the gateway answers `402` with a per-tool `PAYMENT-REQUIRED` challenge, so any x402 client can read the terms and pay.

Settlement is USDC on Base (Sepolia on a test key, mainnet on a live key), plus the native-mandate rail for the first mode.
