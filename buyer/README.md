# Pay a paywall (the buyer side)

To test what you built, an agent has to pay it. Two proven ways.

## 1. The CodeSpar CLI, governed

Pay under a mandate with a cap, a payee allowlist, and a receipt. See [../cli](../cli). This is the governed path: the agent only spends within the limits you set, every payment is auditable, and the same mandate can pay a US API in USDC and a Brazilian store in Pix under one signature.

## 2. A standard x402 client

Any x402 client reads the 402 and pays automatically. [`pay.mjs`](./pay.mjs) uses `@x402/fetch`:

```bash
cd buyer
npm install
PRIVATE_KEY=0x... npm run pay -- https://gw.codespar.dev/your-slug
```

`PRIVATE_KEY` is a funded Base wallet. Test against a `csk_test_` paywall on Base Sepolia (fund it from a faucet) before pointing at mainnet. The wrapped `fetch` reads the 402 challenge, signs an EIP-3009 authorization, retries, and returns the resource.

## The MCP wrapper

There is also a preview MCP server, `@codespar/mcp-x402`, with a `pay_request` tool. It is published but currently targets a generic facilitator shape rather than `gw.codespar.dev`, so treat it as a reference, not a proven path. The two above are the proven ones.
