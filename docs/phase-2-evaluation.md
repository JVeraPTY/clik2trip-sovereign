# Phase 2 — local tourism recommendation evidence

Status: **passed on 9 September 2026**.

Phase 2 passes only when one physical Android arm64 device completes the entire
user flow below after the required model assets and catalog workspace have been
prepared:

1. Capture a new tourism image with the in-app camera.
2. Enable airplane mode and disable Wi-Fi before starting the evaluated run.
3. Extract structured tourism attributes with VisionPsy through `@qvac/sdk`.
4. Query the versioned local tour snapshot with QVAC RAG through `@qvac/sdk`.
5. Display at least one valid recommendation from an approved-provider tour.
6. Delete the captured image after success or failure.
7. Record privacy-safe model, prompt, hardware, token, TTFT, throughput, and
   offline evidence without storing the image, full prompt, or personal data.

## Fixed implementation under evaluation

| Field | Value |
| --- | --- |
| Vision model | VisionPsy-Nano-460M-Flash |
| Vision quantization | Q4_K_M |
| Vision prompt | `tourism-image-extraction-v3` with native JSON Schema constraint |
| Embedding model | EmbeddingGemma 300M |
| Embedding quantization | Q4_0 |
| Catalog snapshot | `approved-seed-es-2026-09-09-v1` |
| Eligible tours | 4 tours from approved providers |
| Recommendation count | Up to 3 |
| Evaluated AI and RAG API | `@qvac/sdk` 0.19.0 only |

The catalog is a declared derivative of the pre-existing Clik2Trip seed data.
It is suitable for offline discovery only. Live price, capacity, eligibility,
and booking state remain server-authoritative and must be revalidated in a
later connected phase.

## Physical-device result

| Evidence | Result |
| --- | --- |
| Release APK installation | Passed; ADB update preserved app data |
| APK SHA-256 | `2935c3f6f0d21e2c484f3496cae3b88f6c53af52bd9044e4f2d28f1535722c15` |
| APK signature | APK Signature Scheme v2 verified |
| App startup | Passed; no JavaScript, Java, or native crash observed |
| Vision model load | Passed from cache in 6,937 ms |
| Local catalog model load and ingestion | Passed; EmbeddingGemma and the four versioned documents were ready in the same session |
| Airplane-mode camera-to-recommendation flow | Passed; structured extraction produced three local recommendations |
| Captured-image deletion | Passed; the app verified that the temporary file no longer existed and displayed `DELETED` |
| Structured performance record | Passed; `evaluation/device-runs/phase-2-offline-recommendation-2026-09-09.json` |

The evaluated run began with airplane mode enabled, Wi-Fi disabled, and no
reachable Internet route. The app's start/end connectivity observer also
reported `offline: true`. VisionPsy emitted 90 tokens with a TTFT of 92,268.859
ms, total completion time of 108,028 ms, throughput of 6.429 tokens/s, and the
GPU backend.

An earlier run using unconstrained text produced inconsistent JSON and was not
accepted as Phase 2 evidence. The final implementation uses QVAC's per-request
native JSON Schema grammar, and the successful rerun rendered structured
attributes rather than raw model output.
