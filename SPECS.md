# How it works, and the specs underneath

Every mode in this repo settles the same way, and the standards are public.

## The x402 handshake

1. An agent calls your gateway URL with no payment.
2. The gateway answers HTTP `402` with the price and terms in the `PAYMENT-REQUIRED` header (x402 protocol version 2). The body mirrors it for humans.
3. The agent signs an EIP-3009 `transferWithAuthorization` for the exact amount and resends with a `PAYMENT-SIGNATURE` header.
4. The gateway verifies the signature, settles the USDC transfer on Base (the payer is gasless; a relayer pays the gas), proxies your upstream, and echoes the settlement in `PAYMENT-RESPONSE`.

Protocol: [x402](https://github.com/coinbase/x402). Settlement primitive: EIP-3009, USDC on Base.

## The receipt

Every settlement seals a tamper-evident, hash-chained receipt that binds the mandate, the quote, the payment, and the delivery. A buyer or an auditor can verify after the fact that the charge was authorized and delivered, without trusting the seller. This is the Know Your Agent (KYA) layer, and it is what a raw rail does not give you.

Formats and open proposals: [agentic-payments-standards](https://github.com/codespar/agentic-payments-standards). The trust page: [codespar.dev/trust](https://codespar.dev/trust).

## The Pix leg (payment links)

A payment link can advertise Pix alongside USDC. A USDC payer settles through the x402 handshake above. A Pix payer, a CodeSpar-native agent under a mandate or a person with the QR, settles through the consumer-payment lifecycle in BRL. There is no FX: the USDC and Pix amounts are priced independently on the same link.

## Governance

Whichever rail, the agent can be made to spend under a signed mandate with a cap, a payee allowlist, and an expiry, enforced before any money moves. See [cli/](./cli) for the governed buyer path.
