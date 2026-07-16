# Pay a paywall with the CodeSpar CLI

The [CodeSpar CLI](https://www.npmjs.com/package/@codespar/cli) pays an x402 endpoint under a governed mandate: a spending cap, a payee allowlist, and a receipt. That is the difference from a raw x402 client. The agent spends within limits you set, and every spend is auditable.

```bash
npm install -g @codespar/cli
codespar login

# 1. Create a mandate that allows spending at your paywall, capped in USDC.
#    --slot is CURRENCY:RAIL:TOTAL_CAP:PER_TX_CAP, in minor units (USDC has 6 decimals).
codespar mandate create --consumer shopper --agent buyer \
  --payee https://gw.codespar.dev/market-data \
  --slot USDC:usdc:1000000:10000

# 2. Pay the paywall. An http(s) payee is routed to x402 (USDC on Base, settled on-chain).
codespar spend --mandate <mandate-id> --amount 10000 --agent buyer \
  --payee https://gw.codespar.dev/market-data

# 3. Show the wallet, the USDC/x402 slot next to the Pix slot.
codespar wallet shopper
```

Amounts and caps are in USDC minor units: `10000` = $0.01, `1000000` = $1.00. Run `codespar mandate create --help` and `codespar spend --help` for the exact flags.

The same mandate can carry a BRL/Pix slot (`--slot BRL:pix:50000:1500`), so one governed agent pays a US API in USDC and a Brazilian store in Pix under one signature, with per-currency caps and no FX. That is the CodeSpar difference from a card-only or crypto-only buyer.
