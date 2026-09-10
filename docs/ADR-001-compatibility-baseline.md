# ADR 001 Compatibility baseline

Status: accepted for the compatibility spike on 9 September 2026.

## Decision

The first build pins QVAC SDK and inference at 0.19.0, WDK React Native Core at 1.0.0 beta 19, Expo at 55.0.31, React Native at 0.83.10, and react native bare kit at 0.14.5. WDK's official starter and peer dependencies use the Expo 55 generation. QVAC 0.19 accepts Expo 54 or later and any bare kit version, so Expo 55 is the narrowest current overlap. React Native 0.83.10 is the patch release bundled by Expo 55.0.31.

Android minimum is API 31, not API 29. RFC 002 recorded API 29 from the earlier mobile integration guidance, while the current QVAC addon compatibility matrix requires Android 12 or later. The implementation follows the stricter runtime requirement and preserves the change here for the jury.

The monorepo uses pnpm's `nodeLinker: hoisted` mode. WDK's current `bare-pack` traversal expects a conventional `node_modules` tree and does not fully resolve pnpm's isolated symlink layout. The lockfile still pins every installed version. Runtime compatibility packages used by the generated worklet are declared explicitly in the Android package rather than fetched during the build.

React Native 0.83.10 ships Gradle 9.0.0 but its Gradle plugin still pins Foojay resolver 0.5.0, which references `JvmVendorSpec.IBM_SEMERU`; Gradle 9 removed that field. The lockfile applies a one-line pnpm patch to use Foojay 1.0.0, the release that removed the deprecated reference for Gradle 9 compatibility. This patch must be removed once the pinned React Native release contains the upstream fix.

Java 17 is the build baseline because the React Native Gradle plugin requests an exact Java 17 toolchain. Using Java 21 to run Gradle would still trigger a second JDK download during the build, increasing setup time and creating an unnecessary external dependency.

React Native Bare Kit 0.14.5 hardcodes Android API 34 and does not declare an NDK version, causing Android Gradle Plugin to select NDK 27 independently. A pnpm patch makes the module inherit this application's API 31/36 and NDK 29 values so every native component uses the same compatibility baseline.

QVAC's Expo linker calculates the project root from the hoisted `react-native-bare-kit` package. In this monorepo that points to the repository root rather than `apps/android`, so the unmodified linker cannot see QVAC's generated addon manifest. QVAC and WDK also depend on different versions of some native addons, which a package-name-only merge would silently collapse. The post-prebuild utility in `apps/android/scripts/configure-native-addons.mjs` parses both generated bundle headers, resolves every exact package path and version, and writes a project-root-aware, ARM64-only linker that verifies all expected libraries. This keeps both runtimes in one APK without packaging unrelated QVAC engines.

WDK's current worklet bundler invokes `npx --no-install` internally. The repository provides a restricted `tools/bin/npx` compatibility shim that resolves only already-installed workspace commands; it never downloads packages. This allows the pinned build to run in minimal Node environments while preserving the same no-install behavior used in GitHub Actions.

## Model assets

- Main model: `VISIONPSY_NANO_460M_MULTIMODAL_Q4_K_M`
- Main model file: `visionpsy-nano-460m-flash-q4_k_m-imat.gguf`
- Main model SHA-256: `90b0abe16180f1fe5918bc5d89c3b6eeaf40520a50f906d6303a59a32b699fbc`
- Main model expected size: 303143488 bytes
- Projection model: `MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0`
- Projection file: `mmproj-visionpsy-nano-460m-flash-q8.gguf`
- Projection SHA-256: `bbb0691873a4e638f6928898b3c3be9a4730bd4ced301197726a4fcb549695d0`
- Projection expected size: 108782144 bytes
- QVAC configuration: context 1024 and `image_no_upscale` enabled

These values come from the registry metadata shipped in `@qvac/inference` 0.19.0 and must match the lockfile used to record the demo.

The local catalog uses the official `EMBEDDINGGEMMA_300M_Q4_0` descriptor through QVAC's `ragIngest` and `ragSearch` APIs:

- Embedding model: `EmbeddingGemma 300M`
- Model file: `embeddinggemma-300m-Q4_0.gguf`
- Quantization: `Q4_0`
- Expected size: 277852192 bytes
- SHA-256: `edc6015cb15694c27be7d1d33f1bc015db9a358ff51ed524628c027504907ba9`

The versioned four-tour snapshot contains no live price, capacity, hold, payment, or booking data. Those fields remain authoritative in Clik2Trip and require an online Gateway revalidation.

## Exit criterion

The gate passes only when one physical Android arm64 device installs the native app and completes, in a single session, a VisionPsy image inference and a WDK wallet create or unlock operation. Type checking, an emulator, or a desktop test does not satisfy the gate.
