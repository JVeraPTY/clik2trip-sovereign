# Quality evaluation dataset

This directory contains 20 tourism-image cases whose expected values were
frozen before inference. The cases exercise activity classification,
destination restraint, duration restraint, visible restrictions, local RAG
recommendations, confidence, and explanation grounding.

## Image rights and reproducibility

Every image comes from Wikimedia Commons under the license recorded beside it
in `sources.json` and `cases.json`. The source page, creator, license name, and
license URL are retained per case. These images are not relicensed under the
repository's MIT license; each remains under its recorded source license.

`sources.json` is the human-reviewed source manifest. Run the following command
to download the exact files and regenerate the locked `cases.json` with byte
counts and SHA-256 digests:

```bash
node tools/fetch-quality-images.mjs
```

The committed images were visually inspected after download. A digest mismatch
causes quality validation to fail.

## Physical-device run

1. Install the evaluation build on the declared Android device and complete the
   one-time model download.
2. Enable airplane mode if the run is intended to contribute offline evidence.
3. Open **Laboratorio de evaluación** and choose **Ejecutar los 20 casos**.
4. Keep the phone on power. The app keeps the screen awake, processes one local
   asset at a time, and writes a privacy-safe JSONL record after every case.
5. Choose **Exportar JSONL** and save the file as
   `evaluation/quality/results.jsonl`.
6. Run both release gates:

```bash
pnpm evaluation:quality:strict
pnpm evaluation:report:strict
```

The exported records contain model identity, hardware, prompt hash and
category, token counts, TTFT, throughput, normalized output, recommendation
identifiers, and an automated visible-evidence grounding check. They do not
contain image bytes, local image paths, prompt bodies, customer information, or
wallet data.

The batch reuses the model already loaded by onboarding, so its `loadMs` is
zero and the rows are classified as warm in-memory runs. The performance report
also includes a cold download/load run and cached reload runs recorded during
the compatibility gate.

## Scoring

`tools/score-quality-evaluation.mjs` uses exact normalized matching against the
accepted values frozen in `cases.json`. It reports:

- category accuracy;
- destination exact-or-not-visible accuracy;
- duration accuracy;
- restriction precision and recall;
- Top 1 and Top 3 recommendation accuracy;
- explanation grounding rate;
- Brier score and mean confidence for correct and incorrect categories.

Failed inference rows remain valid evidence but score zero, including for fields
whose safe default would otherwise match an expected unknown value. They are
reported separately instead of being hidden from the denominator.
