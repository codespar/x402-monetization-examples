# Pricing models: what a seller can charge

A paywall or MCP tool sets `pricing_model` on creation. Four are live today; three more are reserved and rejected with `pricing_model_unsupported` until they ship.

## Flat

The default. One price per call, no `pricing_model` field needed.

```bash
curl -sX POST https://api.codespar.dev/v1/paywalls \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "slug": "market-data",
    "upstream_url": "https://api.example.com/quote",
    "price": "0.01",
    "payto": { "kind": "provisioned", "consumer_id": "your_consumer_id" }
  }'
```

## Tiered

A price curve keyed on settled volume. Ascending `up_to` bounds, up to 10 tiers, the last one `null` for unbounded.

```bash
curl -sX POST https://api.codespar.dev/v1/paywalls \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "slug": "market-data",
    "upstream_url": "https://api.example.com/quote",
    "price": "0.01",
    "pricing_model": "tiered",
    "pricing_tiers": [
      { "up_to": 1000, "price": "0.01" },
      { "up_to": 10000, "price": "0.006" },
      { "up_to": null, "price": "0.003" }
    ],
    "payto": { "kind": "provisioned", "consumer_id": "your_consumer_id" }
  }'
```

`price` still sets the base rate; `pricing_tiers` overrides it above each `up_to` bound.

## Dynamic

The gateway GETs your own price hook on every request and quotes whatever it returns. Fits anything priced off a live input: spot rates, inventory, demand.

```bash
curl -sX POST https://api.codespar.dev/v1/paywalls \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "slug": "fx-quote",
    "upstream_url": "https://api.example.com/convert",
    "price": "0.01",
    "pricing_model": "dynamic",
    "dynamic_price_url": "https://yourserver.com/price-hook",
    "payto": { "kind": "provisioned", "consumer_id": "your_consumer_id" }
  }'
```

`dynamic_price_url` must be a public http(s) URL; the gateway refuses a private or loopback address the same way it refuses one for `upstream_url`.

## Metered

Post-paid usage: the buyer is authorized a ceiling upfront, the seller reports actual usage in a response header, and the gateway refunds the difference on-chain once the call completes. This is the model behind the metering proof already running on mainnet: authorize, charge, refund the difference, all three amounts sealed into one receipt.

```bash
curl -sX POST https://api.codespar.dev/v1/paywalls \
  -H "authorization: Bearer $CODESPAR_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "slug": "llm-inference",
    "upstream_url": "https://api.example.com/generate",
    "price": "0.04",
    "pricing_model": "metered",
    "metered_config": {
      "basis": "tokens",
      "base_atomic": "40000",
      "min_mult": 0.1,
      "max_mult": 1.0,
      "units_header": "x-usage-units"
    },
    "payto": { "kind": "provisioned", "consumer_id": "your_consumer_id" }
  }'
```

`base_atomic` is the ceiling in atomic USDC units (6 decimals; `40000` = $0.04). `min_mult`/`max_mult` bound how far the seller's reported usage can move the final charge from that ceiling. Requires a provisioned `payto` (the refund settles from a wallet CodeSpar controls, not a bring-your-own address) and metered pricing enabled for your account.

## Not live yet

`token`, `time`, and `per_unit` are reserved. Creating a paywall with one of them today returns `pricing_model_unsupported`.
