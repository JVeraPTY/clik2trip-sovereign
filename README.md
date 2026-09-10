# Clik2Trip Sovereign

Clik2Trip Sovereign is an Android-first tourism assistant that interprets a travel image with VisionPsy on the phone, recommends compatible Clik2Trip experiences from a local catalog, and requires the traveler to review and authorize any test USD₮ transfer. The evaluated AI path does not call a cloud inference API.

**Judges and reviewers: [`JUDGES.md`](JUDGES.md) has the APK download, install and testing instructions.**

**[Watch the 2:30 final demo](https://github.com/JVeraPTY/clik2trip-sovereign/releases/download/v0.2.0-hackathon/clik2trip-sovereign-demo.mp4)** — no account or credentials required.

The physical-device compatibility gate, Phase 2, and Phase 3 passed on 9 September 2026. A physical Android phone completed camera capture, JSON-Schema-constrained VisionPsy extraction, QVAC RAG, and approved-provider recommendations in airplane mode, followed by verified deletion of the temporary photo. It then revalidated catalog, price, capacity, and an exact slot through the Clik2Trip Gateway and created a 15-minute hold with a frozen price snapshot and no payment. Phase 4 passed on hardware on 10 September 2026: the traveler authorized a frozen summary with a device credential, the deterministic Policy Engine allowed it, WDK transferred 75.5 test USD₮ on Ethereum Sepolia, and the settlement was verified against an endpoint independent of the bundler.

## What is implemented

- Expo 55 and React Native 0.83 Android scaffold with minimum Android 12.
- QVAC SDK 0.19.0 integration using VisionPsy Nano 460M Flash Q4 K M and its matching Q8 projection model.
- WDK React Native provider configured for Ethereum Sepolia only.
- Camera-driven compatibility screen for local multimodal inference.
- QVAC RAG with EmbeddingGemma 300M Q4 and a versioned offline catalog snapshot: the four approved Clik2Trip tours, plus 52 authored demonstration experiences across nine regions of Panama, ingested for the region the phone resolves to at start-up.
- Coarse device-region resolution at start-up, used only to choose which snapshot to ingest. See `docs/demo-catalog.md`.
- Conservative on-device network observation for reproducible online/offline performance evidence.
- Deterministic checkout Policy Engine with denial codes and tests.
- Human-authorized test USD₮ transfer on Ethereum Sepolia through WDK, gated by a re-read of the server hold and a biometric or PIN confirmation of the frozen summary.
- A configurable sandbox tariff, so a faucet balance funds many settlement runs rather than one. The paymaster still charges gas in the same test token, so the fee, not the amount, is what bounds a balance. The traveler always sees and authorizes both the frozen booking total and the test amount actually transferred, and the statement hash covers both.
- Independent settlement verification that resolves the ERC-4337 UserOperation through the bundler and then re-reads the receipt, the ERC-20 transfer logs, and the confirmation depth from a separate Sepolia JSON-RPC endpoint.
- Privacy-safe performance record schema and aggregation utilities.
- A frozen, attributed 20-image quality dataset plus an on-device batch runner
  and deterministic scorer.
- Typed GraphQL client boundary for the existing Clik2Trip Gateway.
- GitHub Actions for checks, Android preview builds, and signed GitHub Releases.

## Prerequisites

- Node.js 24 and pnpm 11.19.0.
- Java 17.
- Android SDK 36 with platform tools and an arm64 physical device running Android 12 or later.
- USB debugging enabled. QVAC does not support the emulator as acceptance evidence.

## Local setup

```bash
pnpm install
cp apps/android/.env.example apps/android/.env
pnpm wdk:bundle
pnpm check
pnpm evaluation:quality
pnpm evaluation:report
pnpm android:prebuild
pnpm android:device
```

`pnpm android:prebuild` is required after pulling the demonstration catalog change: the Android manifest gains `ACCESS_COARSE_LOCATION` and drops `ACCESS_FINE_LOCATION`, and an older build has neither.

The first QVAC run downloads approximately 412 MB of pinned model assets. Keep the phone connected to power and use a stable network for this one-time download. Once loaded, inference runs on the device.

## Compatibility gate

1. Connect a physical Android arm64 device and confirm it is visible with `adb devices`.
2. Build and install the development client with `pnpm android:device`.
3. Create or unlock the test wallet without exposing its seed.
4. Capture a tourism image and load VisionPsy.
5. Run the local analysis, then enable airplane mode and repeat with the cached model.
6. Record the device, Android version, model load, TTFT, throughput, and outcome in `docs/compatibility-gate.md`.

## Testnet configuration

Only Ethereum Sepolia is enabled. Defaults use the public endpoints and test token documented by WDK. Override them in `apps/android/.env` when rate limits require dedicated endpoints. Never put private credentials in `EXPO_PUBLIC_*` values because those values are embedded in the APK.

`EXPO_PUBLIC_SANDBOX_TARIFF_USDT` sets how much test USD₮ one settlement moves: a decimal amount, or `full` to transfer the frozen booking total as the Phase 4 evidence run recorded. It defaults to `0.01`. The nominal is a testnet artefact and is never presented as the price of an experience.

## Demonstration catalog

The offline snapshot includes authored sample experiences so the local recommendation path has enough material where the connected Clik2Trip catalog is still small. This data was written for this repository: no booking platform was crawled, no third-party text, image or price was copied, and no real operator is named. Every such entry is marked `demo-seed`, shows a `DEMO` marker on screen, and settles through a demonstration path that never contacts the Clik2Trip Gateway and never creates a booking.

`docs/demo-catalog.md` covers the provenance, the location handling and the tariff in full.

## GitHub release

The download and testing instructions written for judges and reviewers are in
[`JUDGES.md`](JUDGES.md).

Every push to `main` produces a standalone, debug-signed preview APK in the `Android preview` workflow. It runs without Metro or a development computer, but it is a workflow artifact: downloading one requires a signed-in GitHub account even on a public repository, and it is deleted after seven days. Artifacts are for the maintainers. Anyone else — a reviewer, a judge, a tester — should be given a GitHub Release instead, whose assets download without an account and do not expire.

The release candidate is `v0.2.0-hackathon` (Android `versionCode` 2). Before a
tag can publish, the workflow requires complete strict quality and performance
reports and the versioned final demo. The generated release manifest binds the
demo URL and digest to the exact tag, commit, APK digest, model, and evaluated
hardware.

Configure these repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`

The release workflow validates the keystore, alias, store password, and private
key password before the Android build. It then verifies the APK signature,
calculates SHA-256, and attaches the APK, checksum, performance report, quality
report, and release manifest to a public GitHub Release. The workflow refuses
to publish placeholders or partial evidence.

## Evaluation

The committed evaluation set contains 20 visually inspected Wikimedia Commons
images with their source pages, creators, licenses, byte counts, SHA-256
digests, and expected labels frozen before inference. The in-app evaluation lab
runs all cases through VisionPsy and the local QVAC RAG on the phone, then
exports privacy-safe JSONL. See `evaluation/quality/README.md` and
`docs/phase-5-evaluation.md`.

For a release-ready evidence check, run:

```bash
pnpm evaluation:quality:strict
pnpm evaluation:report:strict
```

The first command requires exactly one result for every frozen case. The second
requires at least one cold and five warm successful measurements and reports
median and p95 TTFT, throughput, and model-load time.

The 10 September physical-device batch contains 20/20 valid rows and 18
successful inferences. It measured 25% category accuracy, 30% Top-3
recommendation accuracy, a 43.7 s warm median TTFT, and 6.62 tokens/s warm
median throughput. These deliberately unfiltered results are documented with
their limitations and safety implications in `docs/phase-5-evaluation.md`.

The demo recording plan and the final video digest are in
`docs/demo-video.md`. The released MP4 is attached to the same public GitHub
Release as the APK and is accessible without credentials.

## Pre-existing work declaration

Clik2Trip's brand, website, catalog, GraphQL Gateway, Search Service, Booking Service, Payments Service, infrastructure, and all code in the original ClikToTrip repository predate this hackathon submission. They are external platform dependencies and are not represented as new work here. See `docs/preexisting-work.md` for the full boundary.

Everything in this repository begins on 9 September 2026 unless a file explicitly identifies an upstream source. The architecture and business documents dated 8 August 2026 are also pre-existing and were replaced by RFC 002 before implementation.

## Safety

This is hackathon software. It uses testnet funds only and is not a production wallet, travel agency, investment service, or autonomous payment agent. A model result is a recommendation, not an authorization.
