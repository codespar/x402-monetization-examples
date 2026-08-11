# Agent budget burn-down

**Maturity: mcp-server is preview (backend and gateway built and tested, no dashboard UI yet). The cap enforcement is the same governed-mandate mechanism documented in [cli/README.md](../../cli/README.md); nothing new is invented for this example.**

An agent burns down one governed mandate against a priced MCP server until the mandate itself, not a human, stops it.

```
Agent  ──tools/call summarize────▶  gw.codespar.dev/mcp/agent-budget-mcp  ──spend $0.05──▶  ok, caps checked
Agent  ──tools/call deep-analysis▶  same gateway                         ──spend $1.50──▶  blocked: over per_tx_cap
Agent  ──tools/call summarize────▶  same gateway                         ──spend $0.05──▶  blocked: over total_cap (once exhausted)
```

## The scenario

A seller runs an MCP server with two tools: a cheap `summarize` at $0.05 a call, and a `deep-analysis` tool priced well above what any single call should cost, at $1.50. Before the agent starts working, its owner puts it under one CodeSpar mandate with two caps on the same USDC slot: a per-transaction cap of $1.00, so no single call can blow past it, and a total cap of $2.00, so the whole run has a ceiling no matter how many cheap calls it makes.

The agent then works unattended. It calls `summarize` as many times as it needs; each call is a real spend against a real balance, so the mandate's remaining budget drops with every call. When it reaches for `deep-analysis`, the per-tx cap blocks that call on the first attempt, regardless of how much budget is left. When it keeps calling `summarize` long enough to actually spend the full $2.00, the next call is blocked too, this time by the total cap. Neither block needs a human watching, approving, or topping up mid-run.

### The misconception this busts

The instinct is to treat an agent's wallet as a permission flag: either it's allowed to spend, or it isn't. That model has no notion of running out. This example shows the actual precondition for trusting an agent to spend unattended: the wallet is a real, capped, depletable balance, and it fails safe mid-session, not only at a boundary you designed for in advance. A too-expensive call is rejected immediately, independent of remaining budget. A long run of small, legitimate calls is rejected once the budget is actually gone. Both rejections come from the same mandate, checked before any money moves, with no silent overspend and no manual intervention.

## 1. Seller: register the MCP server with two priced tools

[seller.mjs](./seller.mjs) does this over `POST /v1/mcp-servers`, the same call documented in [mcp-server/README.md](../../mcp-server/README.md):

```bash
curl -sX POST https://api.codespar.dev/v1/mcp-servers \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "slug": "agent-budget-mcp",
    "name": "Agent budget burn-down MCP",
    "upstream_url": "https://mcp.yourservice.com",
    "consumer_id": "your_consumer_id",
    "tools": [
      { "tool_name": "summarize", "price": "0.05", "description": "Cheap tool: short summary of the input" },
      { "tool_name": "deep-analysis", "price": "1.50", "description": "Expensive tool: priced above a $1.00 per-tx cap on purpose" }
    ]
  }'
```

You get `https://gw.codespar.dev/mcp/agent-budget-mcp`. Discovery (`tools/list`) stays free; only a priced `tools/call` against `summarize` or `deep-analysis` charges, exactly as [mcp-server/README.md](../../mcp-server/README.md) describes.

Run it:

```bash
cd use-cases/agent-budget-burn-down
CODESPAR_API_KEY=csk_test_... \
UPSTREAM_MCP_URL=https://mcp.yourservice.com \
CONSUMER_ID=your_consumer_id \
  node seller.mjs
```

`UPSTREAM_MCP_URL` must be your own upstream MCP server exposing a `summarize` and a `deep-analysis` tool; this repo doesn't ship one.

## 2. Buyer: one mandate, two caps, burn it down

The buyer side is the CodeSpar CLI under a governed mandate, exactly as documented in [cli/README.md](../../cli/README.md). Create one mandate with a total cap and a per-tx cap on the same USDC slot:

```bash
npm install -g @codespar/cli
codespar login

# --slot is CURRENCY:RAIL:TOTAL_CAP:PER_TX_CAP, in USDC minor units (6 decimals).
# 2000000 = $2.00 total cap, 1000000 = $1.00 per-transaction cap.
codespar mandate create --consumer agent-budget-demo --agent budget-agent \
  --payee https://gw.codespar.dev/mcp/agent-budget-mcp \
  --slot USDC:usdc:2000000:1000000
```

Copy the mandate id it prints, then let [buyer.mjs](./buyer.mjs) run the burn-down:

```bash
CODESPAR_MANDATE_ID=<mandate-id> node buyer.mjs
```

`buyer.mjs` calls `codespar spend --mandate <id> --amount <atomic units> --agent budget-agent --payee https://gw.codespar.dev/mcp/agent-budget-mcp` in a loop, once per tool call, the same `spend` command `cli/README.md` documents. What it drives, in order:

1. `summarize` a handful of times at $0.05 each. All succeed; the mandate's remaining budget drops each time.
2. One `deep-analysis` call at $1.50. Blocked on the first attempt: it exceeds the $1.00 per-tx cap, independent of how much of the $2.00 total is still unspent.
3. `summarize` again, repeatedly, until the running total actually reaches $2.00. The next call after that is blocked too, this time because the total cap has nothing left to give.

Shape of the run (illustrative; the exact text `codespar spend` prints can vary by CLI version, `buyer.mjs` only relies on the exit code):

```
[1/3] summarize x5 at $0.05          -> ok, ok, ok, ok, ok        ($1.75 left of $2.00)
[2/3] deep-analysis at $1.50         -> blocked: exceeds per_tx_cap ($1.00)
[3/3] summarize, repeated            -> ok ... ok ... blocked: exceeds total_cap ($0.00 left)
```

Then look at the mandate directly:

```bash
codespar wallet agent-budget-demo
```

The USDC/x402 slot shows a $2.00 cap, $2.00 spent, $0.00 remaining, the same slot that blocked the two calls above. One mandate, one wallet, two caps, no human topping it up mid-run.

## Honesty

- mcp-server is preview: the backend and gateway are built and tested, matching the calls above exactly, but there is no dashboard UI yet and the API may still change. See the maturity table in the [root README](../../README.md).
- The cap enforcement here is the same governed-mandate mechanism documented in [cli/README.md](../../cli/README.md); nothing about mandates, slots, or caps is new for this example.
- A `csk_test_` key runs the whole loop on Base Sepolia and can never touch mainnet; a `csk_live_` key settles on Base mainnet, same as the API paywall.
- This example is USDC-only. It does not touch the Pix leg, so nothing here claims BRL settlement.
