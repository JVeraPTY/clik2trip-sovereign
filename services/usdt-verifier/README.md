# USD₮ settlement verifier adapter

This package contains the environment-neutral verification core for the future
Clik2Trip Payments Service adapter. It never trusts an amount, token, sender, or
recipient supplied by the mobile client. It resolves a WDK ERC-4337 UserOperation
through the configured bundler, then reads the resulting receipt and block from
an independent Sepolia JSON-RPC endpoint.

Until the proposed Payments subgraph contract is deployed, the Android demo may
run this verifier locally and label the result **sandbox receipt**. That fallback
does not update a Clik2Trip Payment or Booking and must never be shown as a
production confirmation.
