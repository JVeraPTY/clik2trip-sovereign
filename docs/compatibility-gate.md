# Compatibility gate evidence

Status: **passed on 9 September 2026**. The standalone native APK completed a WDK wallet unlock and a VisionPsy image inference in the same session on the physical device.

## Build environment

| Field | Value |
| --- | --- |
| Repository version | 0.1.0 |
| Node | 24 or later |
| Java | 17 |
| Expo | 55.0.31 |
| React Native | 0.83.10 |
| QVAC SDK | 0.19.0 |
| WDK React Native Core | 1.0.0 beta 19 |
| Android minimum | API 31 |

## Device run

The device identity and architecture were read through an authorized USB debugging session. The release APK was installed with ADB and remained alive without a Java or native crash. The encrypted WDK wallet was unlocked first; VisionPsy then downloaded, loaded, and analyzed a newly captured image while that wallet remained ready. The privacy-safe structured record is committed at `evaluation/device-runs/compatibility-gate-online-2026-09-09.json`.

| Evidence | Result |
| --- | --- |
| Device manufacturer and model | Xiaomi 23117RA68G |
| Android version and API level | Android 16, API 36 |
| CPU architecture | arm64-v8a |
| Available memory before model load | 2,526,000 kB (`MemAvailable`) |
| APK installs | Passed; streamed ADB update completed successfully |
| QVAC model and projection download | Passed; 411,925,632 bytes total, progress reached 100% |
| VisionPsy model load | Passed in 70,161 ms |
| Image completion and visible output | Passed; 124 output tokens, GPU backend |
| WDK wallet create or unlock | Passed for creation (`NO_WALLET` to `READY`); encrypted state persisted across reinstall and returned as `LOCKED` |
| Both operations in one app session | Passed; wallet remained `READY` through QVAC load and completion |
| Airplane-mode repeat with cached model | Passed; airplane mode on, Wi-Fi off, no reachable Internet route, app-recorded `offline: true` |
| Online inference timing | TTFT 95,263.48 ms; total 115,831 ms; 6.51 tokens/s |
| Offline inference timing | Cached load 7,363 ms; TTFT 93,224.683 ms; total 114,733 ms; 6.19 tokens/s |

## Generated artifacts

| Evidence | Result |
| --- | --- |
| WDK worklet bundle | Generated successfully from the pinned lockfile |
| QVAC mobile bundle | Generated and verified by the Expo prebuild plugin |
| Android debug build | Successful (`assembleDebug`, 385 tasks) |
| Standalone release build | Successful (`assembleRelease`, embedded JavaScript bundle) |
| Preview APK | 245 MB; APK Signature Scheme v2 verified with the local debug certificate |
| Preview APK SHA-256 | `eb487de7e992dfbc557a035d21c22fb3d7a8b7a3ea3844b7e93cf26f88924378` |
| Native target ABI | arm64-v8a only |
| Native minimum SDK | API 31 |
| Native addon packaging | 40 exact-version ARM64 addons inside 61 packaged ARM64 libraries; includes QVAC's `bare-signals` 4.2.0, WDK's `bare-signals` 5.0.0, QVAC completion/embedding, and every addon referenced by both generated bundles |

The online and offline JSON performance records are stored in `evaluation/device-runs/`. Attach the Git commit used for the final demo, but do not attach the captured image, seed phrase, complete prompt, or full wallet address.
