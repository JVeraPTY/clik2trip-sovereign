# Clik2Trip Sovereign

Clik2Trip Sovereign is an Android-first tourism assistant that interprets a travel image with VisionPsy on the phone, recommends compatible Clik2Trip experiences from a local catalog, and requires the traveler to review and authorize any test USD₮ transfer. The evaluated AI path does not call a cloud inference API.

The physical-device compatibility gate, Phase 2, and Phase 3 passed on 9 September 2026. A physical Android phone completed camera capture, JSON-Schema-constrained VisionPsy extraction, QVAC RAG, and approved-provider recommendations in airplane mode, followed by verified deletion of the temporary photo. It then revalidated catalog, price, capacity, and an exact slot through the Clik2Trip Gateway and created a 15-minute hold with a frozen price snapshot and no payment. Phase 4 is in progress: the deterministic Policy Engine, the WDK test USD₮ transfer on Ethereum Sepolia, and independent settlement verification are implemented and awaiting their physical-device evidence run.

## What is implemented

- Expo 55 and React Native 0.83 Android scaffold with minimum Android 12.
- QVAC SDK 0.19.0 integration using VisionPsy Nano 460M Flash Q4 K M and its matching Q8 projection model.
- WDK React Native provider configured for Ethereum Sepolia only.
- Camera-driven compatibility screen for local multimodal inference.
- QVAC RAG with EmbeddingGemma 300M Q4 and a versioned four-tour offline catalog snapshot.
- Conservative on-device network observation for reproducible online/offline performance evidence.
- Deterministic checkout Policy Engine with denial codes and tests.
- Human-authorized test USD₮ transfer on Ethereum Sepolia through WDK, gated by a re-read of the server hold and a biometric or PIN confirmation of the frozen summary.
- Independent settlement verification that resolves the ERC-4337 UserOperation through the bundler and then re-reads the receipt, the ERC-20 transfer logs, and the confirmation depth from a separate Sepolia JSON-RPC endpoint.
- Privacy-safe performance record schema and aggregation utilities.
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
pnpm android:prebuild
pnpm android:device
```

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

## GitHub release

Every push to `main` produces a standalone, debug-signed preview APK in the `Android preview` workflow. It can be downloaded from that workflow's artifacts for seven days and does not require Metro or a development computer.

Push a tag such as `v0.1.0-hackathon` after configuring these repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`

The release workflow builds the APK, calculates SHA-256, and attaches both files to a GitHub Release.

## Pre-existing work declaration

Clik2Trip's brand, website, catalog, GraphQL Gateway, Search Service, Booking Service, Payments Service, infrastructure, and all code in the original ClikToTrip repository predate this hackathon submission. They are external platform dependencies and are not represented as new work here. See `docs/preexisting-work.md` for the full boundary.

Everything in this repository begins on 9 September 2026 unless a file explicitly identifies an upstream source. The architecture and business documents dated 8 August 2026 are also pre-existing and were replaced by RFC 002 before implementation.

## Safety

This is hackathon software. It uses testnet funds only and is not a production wallet, travel agency, investment service, or autonomous payment agent. A model result is a recommendation, not an authorization.
