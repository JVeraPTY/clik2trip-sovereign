# Clik2Trip Sovereign implementation rules

The source of truth is RFC 002 at
`/Users/josevera/Desktop/ClikToTrip/tether/RFC_tecnico_Clik2Trip_Sovereign_FINAL.docx`.

## Non-negotiable boundaries

- All evaluated AI inference and RAG run locally through `@qvac/sdk`. Never add a cloud-AI fallback.
- The model can recommend and prepare a checkout, but it never receives a seed, private key, signature, or callable transfer method.
- Every transfer requires an explicit, current human approval after the final checkout summary is shown.
- The Android client talks to Clik2Trip only through its GraphQL Gateway.
- Clik2Trip remains the source of truth for catalog freshness, price, capacity, holds, payments, and bookings.
- Price and capacity must be revalidated before the hold and again before payment.
- Payment and booking statuses remain independent.
- Testnet only until a separate legal, fiscal, operational, and security ADR approves production.
- Never log images, prompt bodies, seed phrases, private keys, or full wallet addresses.
- Pin release dependencies exactly and keep the lockfile committed.

## Delivery order

1. Pass the QVAC plus WDK compatibility gate on one physical Android arm64 device.
2. Implement the camera, VisionPsy extraction, local RAG, and offline recommendation.
3. Add the typed GraphQL catalog, availability, and hold flow.
4. Add the deterministic Policy Engine, WDK testnet transfer, and independent settlement verification.
5. Publish measurements, a signed APK in GitHub Releases, documentation, and the demo video.

Do not start a later stage until the previous stage's exit criterion is recorded in `docs/compatibility-gate.md` or the corresponding evaluation report.

Run `pnpm check` before considering any change complete.
