# Phase 5 — measurements and public delivery

Status: **release candidate complete on 10 September 2026**. The reproducible
dataset, device runner, scoring tools, performance aggregation, release gates,
final video, and judge guide are complete. The physical-device quality and
performance gates pass. Publication is performed atomically by the
`v0.2.0-hackathon` tag: the signed APK, video, checksums, manifest, and reports
become public assets of the same GitHub Release.

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
| Public demo video | Versioned MP4 attached by the release workflow |
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

## Physical-device results

The frozen 20-case batch ran on the hardware above from
`2026-09-10T17:47:25.605Z` through `2026-09-10T18:07:20.957Z`. All 20 rows are
present and structurally valid; 18 inference calls succeeded and two failed.
Failed calls remain in the denominator and score zero instead of being hidden.

| Quality metric | Result |
| --- | ---: |
| Category accuracy | 25% |
| Destination exact-or-not-visible accuracy | 10% |
| Duration accuracy | 70% |
| Restriction precision | 5% |
| Restriction recall | 90% |
| Top-1 recommendation accuracy | 30% |
| Top-3 recommendation accuracy | 30% |
| Explanation grounding rate | 35% |
| Confidence Brier score | 0.278 |

The run is reproducible evidence, not a claim that the nano model is reliable
enough to authorize a booking or payment. Category, destination, restrictions,
explanations, and confidence require improvement. The product therefore treats
VisionPsy output only as a suggestion: local catalog filtering is deterministic,
live price and capacity are revalidated, and a human must approve the frozen
payment summary with a device credential.

The performance report contains one successful cold run and 22 warm rows, of
which 20 succeeded. This exceeds the required one cold and five successful warm
runs. The warm median TTFT is 43,717.929 ms, warm p95 TTFT is 92,268.859 ms,
median throughput is 6.618 tokens/s, and p95 throughput is 6.935 tokens/s. Two
separate compatibility runs were captured in airplane mode; the 20-case quality
batch itself recorded `offline: false`.

## Delivery evidence

- Final narrated video: 149.667 seconds, H.264/AAC, SHA-256
  `fffca854608ef5189067f5e0a609d1494ead2dce65e26fdef86b4714a3f0a568`.
- Final flow includes the sandbox receipt, two Sepolia confirmations, and the
  independent Payment `VERIFICADO` / Booking `NUEVA` states.
- The release workflow validates all four Android signing inputs, builds and
  verifies the signed APK, and publishes the APK, video, digests, manifest, and
  reports together.
- [`JUDGES.md`](../JUDGES.md) provides the account-free download, installation,
  reproducibility, limitations, and ten-minute test instructions.

No placeholder is counted as a pass. The release workflow refuses to publish if
any of these machine-checkable inputs is absent.
