# Evaluation evidence

This directory holds reproducible, permission-cleared evaluation records. Do not commit traveler images or personal prompts. Device-run records intentionally omit booking identifiers, customer data, wallet addresses, and secrets.

The final dataset must contain at least 20 cases with expected category, destination visibility, duration, restrictions, and recommendation criteria defined before inference. Each run records the model name, quantization, hardware, prompt hash, tokens, TTFT, throughput, success, and normalized error code.

The `device-runs/compatibility-gate-*-2026-09-09.json` files record the physical-device online and airplane-mode compatibility runs. They are not part of the final 20-case quality dataset.

`device-runs/phase-2-offline-recommendation-2026-09-09.json` records the accepted
camera-to-recommendation run for the Phase 2 exit criterion. Its corresponding
flow and privacy checks are documented in `docs/phase-2-evaluation.md`.

`device-runs/phase-3-connected-hold-2026-09-09.json` records the accepted
price, capacity, and hold run for the Phase 3 exit criterion, documented in
`docs/phase-3-evaluation.md`.

The Phase 4 authorized-settlement record is not written yet. Its required fields
and the physical-device flow it must evidence are defined in
`docs/phase-4-evaluation.md`. Record the testnet transaction hash, which is
public chain data, but omit booking identifiers, customer data, full wallet
addresses, and secrets.
