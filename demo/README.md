# End-to-end demo

One script that plays both sides on Base Sepolia: it creates a paywall, calls it once with no payment to show the raw `402`, then pays it as an agent and gets the resource. It deletes the paywall when it finishes.

```
[1] Seller  POST /v1/paywalls  ─────▶  gw.codespar.dev/demo-xxxx  (in front of a public API)
[2] Unpaid  GET  the gateway   ◀─402── the challenge (price, asset, network)
[3] Buyer   pay with @x402/fetch ──▶   signs EIP-3009, settles USDC, retries, gets the resource
[4] Cleanup DELETE the paywall
```

## Prerequisites

- Node 18 or newer.
- A CodeSpar test key (`csk_test_...`) from [codespar.dev](https://codespar.dev). The script refuses anything else, so it can never touch mainnet.
- A Base Sepolia wallet with a little test USDC. The payer is gasless (a relayer pays the gas), so it needs USDC but not ETH. Fund it from a Base Sepolia USDC faucet, for example [faucet.circle.com](https://faucet.circle.com).

## Run

```bash
cd demo
cp .env.example .env    # fill in CODESPAR_API_KEY and PRIVATE_KEY
npm install
npm start
```

Expected output:

```
[1/4] Creating paywall "demo-xxxx" in front of https://api.github.com/zen ...
  live at https://gw.codespar.dev/demo-xxxx

[2/4] Calling it with no payment ...
  HTTP 402
  challenge: pay 10000 atomic USDC on eip155:84532 to 0x...

[3/4] Paying with an x402 client (payer 0x...) ...
  HTTP 200
  settled tx 0x... on eip155:84532
  upstream returned: <a line of GitHub zen>

Done. An agent paid $0.01 in USDC over x402 and got the resource.

[4/4] Deleting demo paywall pw_... ...
```

## What it shows

The same URL answers `402` to an unpaid caller and `200` to a paid one, with no signup and no card in between. The `402` carries the price and terms; the client reads them, signs once, and the gateway settles on-chain and proxies the upstream. That is the whole x402 seller-plus-buyer loop in one file.

To go further: swap `UPSTREAM_URL` for your own API, set `PAYTO_ADDRESS` to a second wallet to watch funds move, or replace the buyer half with the governed [CLI path](../cli) to pay under a mandate.
