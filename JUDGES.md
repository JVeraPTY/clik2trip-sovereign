# Judge guide — download, install and test the APK

Clik2Trip Sovereign is an Android tourism assistant. A traveler photographs a
place, **VisionPsy runs on the phone** to interpret the image, a **local QVAC RAG**
recommends compatible experiences from an offline catalog, and any test USD₮
transfer on **Ethereum Sepolia** requires the traveler to authorize a frozen
summary with a device credential. The evaluated AI path calls no cloud
inference API.

This page is only about getting the build onto a phone and checking the claims.
The engineering detail is in [`README.md`](README.md); the measured results are
in [`docs/phase-5-evaluation.md`](docs/phase-5-evaluation.md).

**Start here:** [watch the 2:30 final demo](https://github.com/JVeraPTY/clik2trip-sovereign/releases/download/v0.2.0-hackathon/clik2trip-sovereign-demo.mp4).
The video is a public GitHub Release asset and requires no account.

## 1. What you need

| Requirement | Why |
| --- | --- |
| A **physical** Android phone, arm64, **Android 12 or later** (`minSdkVersion` 31) | QVAC does not run on the emulator |
| About **1.5 GB free storage** | The app plus approximately 412 MB of pinned model assets |
| Wi-Fi and a charger for the first launch | One-time model download |
| A screen lock (fingerprint or PIN) enabled | The payment authorization requires a device credential |
| Test USD₮ on Sepolia — **only** for the payment step | See [step 6](#6-optional-the-test-usd-settlement) |

Everything except the payment step works on an unfunded phone, and steps 4 and 5
work with **no network at all** once the model is cached.

The interface is in Spanish. Every on-screen label this guide expects is quoted,
so it can be followed without reading Spanish.

## 2. Download the APK

### Primary route — GitHub Release (no account, no expiry)

**<https://github.com/JVeraPTY/clik2trip-sovereign/releases/latest>**

Download these assets:

| Asset | What it is |
| --- | --- |
| `clik2trip-sovereign.apk` | The signed, standalone build. No Metro, no development computer. |
| `clik2trip-sovereign.apk.sha256` | Checksum of that exact file |
| `release-manifest.json` | Tag, commit, APK digest, model, quantization, evaluated hardware, network |
| `performance-report.json` | Cold and warm TTFT, throughput, model-load time |
| `quality-report.json` | Scores over the 20 frozen evaluation cases |
| `clik2trip-sovereign-demo.mp4` | Final 2:30 narrated demonstration, including the independently verified sandbox receipt |

The release candidate is **`v0.2.0-hackathon`** (Android `versionCode` 2,
package `com.clik2trip.sovereign`). Release assets download **without signing
in** and do not expire.

Verify the file before installing:

```bash
shasum -a 256 -c clik2trip-sovereign.apk.sha256
```

The same digest appears in `release-manifest.json` under `android.apkSha256`,
bound there to the tag and commit it was built from.

### If the Releases page is empty or the asset is missing

The release is published by a tag-triggered workflow that refuses to publish on
partial evidence, so a missing release means the gate has not passed yet rather
than that a build is being withheld. Two fallbacks:

1. **Preview APK from CI.** Every push to `main` builds a standalone APK in the
   [`Android preview`](https://github.com/JVeraPTY/clik2trip-sovereign/actions/workflows/android-preview.yml)
   workflow. Open the newest successful run and download the
   `clik2trip-sovereign-preview-apk` artifact. Two caveats: GitHub requires a
   signed-in account to download any artifact, even on a public repository, and
   artifacts are deleted after seven days. This build is **debug-signed**, so it
   cannot be installed over the release build without uninstalling first.
2. **Build it yourself.** The full toolchain and commands are in
   [`README.md`](README.md#local-setup). This needs Node 24, pnpm 11.19.0,
   Java 17, Android SDK 36 and a connected device.

## 3. Install

On the phone, open the downloaded APK and allow installation from your browser
or file manager when Android asks ("Install unknown apps"). Or, from a computer
with `adb`:

```bash
adb install -r clik2trip-sovereign.apk
```

If Android reports a signature conflict (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`),
an earlier debug-signed preview is installed. Remove it first:

```bash
adb uninstall com.clik2trip.sovereign
```

The app requests **camera** and **coarse location**. Fine location is blocked in
the manifest, not merely unused. Coarse location is used once at start-up, only
to choose which offline catalog snapshot to load; refusing it is a supported
outcome and the screen then says `Sin ubicación: mostrando Ciudad de Panamá`.

## 4. First launch

Keep the phone on Wi-Fi and power. Four onboarding steps run in order and each
names the artefact it is preparing:

1. `Ubicando tu zona` — resolves a coarse region.
2. `Cargando el modelo de visión` — downloads and loads VisionPsy Nano 460M
   Flash Q4_K_M with its Q8 projection, about **412 MB**, with a percentage.
   This is the slow one, and it happens **once**.
3. `Preparando el catálogo local` — ingests the offline catalog with
   EmbeddingGemma 300M Q4.
4. `Inicializando la wallet de prueba` — creates or unlocks the Sepolia test
   wallet. No seed phrase is ever displayed.

After this, inference is local. A failed step stops and says so instead of
silently retrying a 412 MB download.

## 5. The 10-minute test

Expect roughly **40–60 seconds** per photo analysis on mid-range hardware; the
measured warm median time-to-first-token is 43.7 s. That is slow, it is what an
on-device 460M vision model costs, and it is reported rather than hidden.

| Step | What to do | What confirms the claim |
| --- | --- | --- |
| Local inference | Tap `Capturar imagen`, photograph anything touristic — a beach, a boat, a trail, a city street | Progress is local; the result panel names the model and quantization |
| Real offline | Enable **airplane mode**, then capture and analyse again | The analysis and the recommendations still complete with the radios off |
| Privacy | Read `Foto temporal:` in the result panel, then open `Evidencia local` | The state reads `DELETED`: the temporary photo is removed and the check is a re-read, not an assumption. The record below carries no image and no personal prompt |
| Grounding | Read `Recomendado para tu foto` | The explanation cites the catalog entry it came from, and the model result is presented as a suggestion, not a decision |
| Demo vs. real data | Compare cards | Sample entries show a `DEMO` pill, are provided by `Operador demo <región>`, and reserve only on the phone. The four real Clik2Trip tours carry no price of their own — price and capacity come from the Gateway |
| Live revalidation | Leave airplane mode, open a real Clik2Trip tour and continue to checkout | Catalog identity, price, capacity and an exact slot are re-read through the Clik2Trip Gateway, and a 15-minute hold with a frozen price and a countdown is created **without any payment** |

Stopping here is a complete test of the edge-AI claims. No funds are involved up
to this point.

## 6. Optional: the test USD₮ settlement

This moves a real transaction on a **public testnet** with **valueless test
tokens**. There is no mainnet path in the build: the wallet is configured for
Ethereum Sepolia (chainId 11155111) only.

The phone needs test USD₮ at token
`0xd077a400968890eacc75cdc901f0356c943e4fdb` (6 decimals), because the ERC-4337
paymaster charges gas in that same token. To fund it, open the settlement panel,
tap `Ver direcciones completas`, and copy the payer address. Then either use the
Sepolia test-token faucet documented by WDK, or send that address to the
maintainer (see [step 8](#8-contact)) and it will be funded — that is usually
the faster route during judging.

One settlement transfers **0.01 test USD₮** by default, while the fee runs about
1.5–2.8 test USD₮; the fee, not the amount, is what bounds how many runs a
balance affords. Both figures are always on screen:
`Total de la reserva: USD 75.50` above `Se transferirá: 0.01 USD₮`, with the
second marked as a testnet nominal. Set
`EXPO_PUBLIC_SANDBOX_TARIFF_USDT=full` at build time to transfer the whole
frozen total instead, which is what the recorded Phase 4 evidence run did.

What to check as you go:

- The frozen summary names network, token, recipient, both amounts, the fee, the
  expiry, the booking code and an integrity hash before you approve anything.
- The **biometric or PIN prompt names both amounts.** The authorized bytes cover
  the booking total, the currency, the tariff mode and the transferred amount, so
  changing the total behind the traveler breaks the hash. There is a test for it.
- The server hold is re-read immediately before the transfer. An expired or
  altered hold is refused by the deterministic Policy Engine with a denial code.
- After submission the app resolves the UserOperation through the bundler and
  then re-reads the receipt, the ERC-20 transfer logs and the confirmation depth
  from a **separate** Sepolia JSON-RPC endpoint before showing
  `RECIBO SANDBOX VERIFICADO`. Verification does not trust the party that
  submitted the transaction.

Nothing here is autonomous. No transfer happens without a current human
authorization on the phone in front of you.

## 7. Evidence and honest limitations

The in-app evaluation lab can re-run the frozen 20-case dataset on your own
phone and export privacy-safe JSONL. The committed run of 10 September 2026, on
a Xiaomi 23117RA68G (Android 16, arm64, QVAC SDK 0.19.0), contains 20/20 valid
rows and 18 successful inferences:

| Metric | Result |
| --- | ---: |
| Category accuracy | 25% |
| Top-3 recommendation accuracy | 30% |
| Duration accuracy | 70% |
| Restriction recall | 90% |
| Explanation grounding rate | 35% |
| Warm median TTFT | 43.7 s |
| Warm median throughput | 6.62 tokens/s |

**These numbers are deliberately unfiltered.** Failed inferences stay in the
denominator and score zero. A 460M nano model on a phone is not accurate enough
to authorize a booking or a payment, and the product is built on that
assumption: catalog filtering is deterministic, price and capacity are
revalidated server-side, the Policy Engine is deterministic with explicit denial
codes, and a human must approve the frozen summary with a device credential. The
full discussion, including the two failures, is in
[`docs/phase-5-evaluation.md`](docs/phase-5-evaluation.md).

Two boundaries worth knowing before scoring:

- **Pre-existing work.** Clik2Trip's brand, website, catalog, GraphQL Gateway,
  Search, Booking and Payments services and infrastructure predate this
  submission and are external dependencies, not new work.
  [`docs/preexisting-work.md`](docs/preexisting-work.md) draws the line file by
  file. Everything in this repository starts on 9 September 2026 unless a file
  names an upstream source.
- **Demonstration data.** The 52 sample experiences were authored for this
  repository. No booking platform was crawled, no third-party text, image or
  price was copied, and no real operator is named.
  [`docs/demo-catalog.md`](docs/demo-catalog.md) has the provenance in full.

## 8. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | A debug-signed preview is installed. `adb uninstall com.clik2trip.sovereign`, then install again. |
| Install blocked | Allow installation from the app you are opening the APK with, in Android's "Install unknown apps" setting. |
| The model step fails or stalls | The 412 MB download needs a stable network. It stops rather than retrying on its own; use the onboarding footer to retry. |
| Analysis seems stuck | Warm p95 TTFT is 92 s. Give a run up to two minutes before treating it as failed. |
| `Sin ubicación: mostrando Ciudad de Panamá` | Expected when coarse location is refused, disabled, or slow. Not a failure. |
| Checkout says the balance is insufficient | The paymaster fee is charged in test USD₮. Fund the payer address, or stay with steps 4 and 5, which need no funds. |
| `TARIFA_SANDBOX_INVALIDA` | A malformed `EXPO_PUBLIC_SANDBOX_TARIFF_USDT` at build time. The default 0.01 applies and the screen says so. |
| Rate-limit errors from the public RPC | The public endpoints are shared. Dedicated endpoints can be set in `apps/android/.env` for a local build. |

## 9. Contact

Repository: <https://github.com/JVeraPTY/clik2trip-sovereign>
Maintainer: Jose Vera — open an issue on the repository, and it will be seen
during the judging window.

## Safety

This is hackathon software. It uses testnet assets only and is not a production
wallet, a travel agency, an investment service, or an autonomous payment agent.
A model result is a recommendation, never an authorization.
