#!/usr/bin/env bash
# Buyer side: an AP agent pays the freight invoice under a governed mandate,
# using the CodeSpar CLI's mandate/spend path (see ../../cli/README.md).
#
# The mandate is created once, capped at exactly $2,400 USDC (both the total
# cap and the per-transaction cap) and allowlisted to exactly this invoice's
# payment link. The agent never handles a private key or a signature it could
# reuse elsewhere; it can only ever pay this one payee, up to this one amount.
# `codespar spend` routes an http(s) payee to x402 automatically (the CLI
# signs and settles the USDC/Base leg for you), and every spend is checked
# against the cap and the allowlist before anything moves.
#
# Requires the CodeSpar CLI:
#   npm install -g @codespar/cli
#   codespar login
#
# PAYEE_URL is the pay_url seller.mjs printed. CodeSpar assigns the link's
# slug, so there is nothing to guess and no default worth having here.
#
# Usage:
#   PAYEE_URL=<pay_url> ./buyer.sh                             # step 1: create the mandate
#   PAYEE_URL=<pay_url> MANDATE_ID=<id-from-step-1> ./buyer.sh # step 2: spend it, then show the wallet

set -euo pipefail

if [ -z "${PAYEE_URL:-}" ]; then
  echo "Set PAYEE_URL to the pay_url that seller.mjs printed." >&2
  echo "CodeSpar assigns the link's slug; a guessed one answers 404 payment_link_not_found." >&2
  exit 1
fi
CONSUMER="${CONSUMER:-buyerco}"
AGENT="${AGENT:-payer}"
AMOUNT="${AMOUNT:-2400000000}"   # $2,400.00 in USDC atomic units (6 decimals)

if [ -z "${MANDATE_ID:-}" ]; then
  echo "[1/3] Creating a mandate capped and allowlisted to this exact invoice ..."
  codespar mandate create --consumer "$CONSUMER" --agent "$AGENT" \
    --payee "$PAYEE_URL" \
    --slot "USDC:usdc:${AMOUNT}:${AMOUNT}"
  echo
  echo "Copy the mandate id printed above, then re-run:"
  echo "  MANDATE_ID=<mandate-id> ./buyer.sh"
  exit 0
fi

echo "[2/3] Spending the mandate to pay the invoice ..."
codespar spend --mandate "$MANDATE_ID" --amount "$AMOUNT" --agent "$AGENT" --payee "$PAYEE_URL"

echo
echo "[3/3] Wallet: the debit and the sealed receipt ..."
codespar wallet "$CONSUMER"
