# Evaluation evidence

This directory holds reproducible, permission-cleared evaluation records. Do not commit traveler images or personal prompts. Device-run records intentionally omit booking identifiers, customer data, wallet addresses, and secrets.

The final dataset contains 20 cases with expected category, destination
visibility, duration, restrictions, and recommendation criteria defined before
inference. `quality/cases.json` locks each reusable image by byte count and
SHA-256. Each exported run records the model name, quantization, hardware,
prompt hash, tokens, TTFT, throughput, success, and normalized error code.

The `device-runs/compatibility-gate-*-2026-09-09.json` files record the physical-device online and airplane-mode compatibility runs. They are not part of the final 20-case quality dataset.

`device-runs/phase-2-offline-recommendation-2026-09-09.json` records the accepted
camera-to-recommendation run for the Phase 2 exit criterion. Its corresponding
flow and privacy checks are documented in `docs/phase-2-evaluation.md`.

`device-runs/phase-3-connected-hold-2026-09-09.json` records the accepted
price, capacity, and hold run for the Phase 3 exit criterion, documented in
`docs/phase-3-evaluation.md`.

`device-runs/phase-4-authorized-settlement-2026-09-10.json` records the accepted
human-authorized WDK transfer and independent Sepolia verification. Its flow,
limitations, and privacy audit are documented in
`docs/phase-4-evaluation.md`. The transaction hash is public testnet data;
booking identifiers, customer data, full wallet addresses, and secrets remain
omitted.

`performance-runs.json` classifies the cold and warm measurements used by
`tools/build-performance-report.mjs`. The quality JSONL contributes warm
in-memory runs once exported from the physical device. Strict aggregation
requires one cold and at least five warm successful rows.

`quality/` holds the frozen 20-case dataset, source-license metadata, the
on-device collection instructions, and the generated quality report. Until
`quality/results.jsonl` is present and complete, both reports are deliberately
marked `incomplete` and the release workflow refuses to publish.
