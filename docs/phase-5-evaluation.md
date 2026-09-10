# Phase 5 — measurements and public delivery

Status: **in progress on 10 September 2026**. The reproducible dataset, device
runner, scoring tools, performance aggregation, release gates, and demo runbook
are implemented. Phase 5 passes only after the physical-device batch has
produced 20 quality rows, the public video URL is set, and a signed APK can be
downloaded from a successful GitHub Release.

## Implemented release gates

| Requirement | Automated evidence |
| --- | --- |
| One cold and at least five warm runs | `tools/build-performance-report.mjs --strict` |
| Model, quantization, prompts, tokens, TTFT, throughput | `evaluation/performance-report.json` |
| Median and p95 for TTFT and throughput | Performance report aggregation |
| At least 20 quality cases frozen before inference | `evaluation/quality/cases.json` |
| Image permission and reproducibility | Source page, creator, license, byte count, SHA-256 per case |
| Domain-quality metrics | `tools/score-quality-evaluation.mjs --strict` |
| No personal prompt or image in records | Schema and forbidden-field validation |
| Signed downloadable APK and checksum | Tag-triggered `Android release` workflow |
| Public demo video | Required `DEMO_VIDEO_URL` repository variable |
| Version, commit, model, hardware alignment | Generated `release-manifest.json` asset |

## Physical hardware

| Field | Value |
| --- | --- |
| Manufacturer and model | Xiaomi 23117RA68G |
| Android | Android 16, API 36 |
| Architecture | arm64-v8a |
| Vision model | VisionPsy-Nano-460M-Flash Q4_K_M |
| Projection | VisionPsy Nano 460M Flash Q8_0 |
| Embeddings | EmbeddingGemma 300M Q4_0 |
| QVAC SDK | 0.19.0 |

## Remaining evidence

- Export the completed 20-row physical-device run to
  `evaluation/quality/results.jsonl`.
- Generate strict quality and performance reports.
- Record and publish the video under five minutes, then set `DEMO_VIDEO_URL`.
- Correct the Android signing secrets in GitHub if the next release preflight
  still rejects them.
- Push the final tag and verify that the APK downloads without authentication,
  installs, and launches on the declared phone.

No placeholder is counted as a pass. The release workflow refuses to publish if
any of these machine-checkable inputs is absent.
