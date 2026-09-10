import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appConfig = JSON.parse(await readFile(resolve(repositoryRoot, 'apps/android/app.json'), 'utf8'));
const performance = JSON.parse(
  await readFile(resolve(repositoryRoot, 'evaluation/performance-report.json'), 'utf8'),
);
const quality = JSON.parse(
  await readFile(resolve(repositoryRoot, 'evaluation/quality/quality-report.json'), 'utf8'),
);
const apkPath = resolve(repositoryRoot, 'clik2trip-sovereign.apk');
const apk = await readFile(apkPath);
const apkSha256 = createHash('sha256').update(apk).digest('hex');
const tag = process.env.RELEASE_TAG ?? '';
const commit = process.env.RELEASE_COMMIT ?? '';
const videoUrl = process.env.DEMO_VIDEO_URL ?? '';
const expectedTag = `v${appConfig.expo.version}-hackathon`;

if (tag !== expectedTag) throw new Error(`RELEASE_TAG_MISMATCH: expected ${expectedTag}`);
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('RELEASE_COMMIT_INVALID');
if (performance.status !== 'complete') throw new Error('PERFORMANCE_REPORT_INCOMPLETE');
if (quality.status !== 'complete') throw new Error('QUALITY_REPORT_INCOMPLETE');
const parsedVideoUrl = new URL(videoUrl);
if (parsedVideoUrl.protocol !== 'https:') throw new Error('DEMO_VIDEO_URL_MUST_USE_HTTPS');

const manifest = {
  schemaVersion: 1,
  product: 'Clik2Trip Sovereign',
  version: appConfig.expo.version,
  tag,
  commit,
  android: {
    package: appConfig.expo.android.package,
    versionCode: appConfig.expo.android.versionCode,
    minSdkVersion: 31,
    targetSdkVersion: 36,
    apkFile: 'clik2trip-sovereign.apk',
    apkBytes: apk.byteLength,
    apkSha256,
    signing: 'release keystore from GitHub Actions Secrets',
  },
  evaluatedHardware: performance.hardware,
  ai: {
    qvacSdkVersion: performance.model.qvacSdkVersion,
    model: performance.model.name,
    quantization: performance.model.quantization,
    modelAndProjectionBytes: performance.model.bytes,
    inferenceLocation: 'physical Android device',
    cloudInferenceFallback: false,
  },
  settlement: {
    network: 'Ethereum Sepolia',
    chainId: 11155111,
    tokenContract: '0xd077a400968890eacc75cdc901f0356c943e4fdb',
    mode: 'testnet sandbox only',
  },
  evidence: {
    performanceReport: 'performance-report.json',
    qualityReport: 'quality-report.json',
    videoUrl,
  },
};

await writeFile(
  resolve(repositoryRoot, 'clik2trip-sovereign.apk.sha256'),
  `${apkSha256}  clik2trip-sovereign.apk\n`,
);
await writeFile(
  resolve(repositoryRoot, 'release-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
await writeFile(
  resolve(repositoryRoot, 'release-notes.md'),
  `# Clik2Trip Sovereign ${appConfig.expo.version}\n\n` +
    `Android edge-AI hackathon build. VisionPsy and QVAC RAG run locally; WDK settlement is restricted to Ethereum Sepolia testnet and always requires current human authorization.\n\n` +
    `- Commit: \`${commit}\`\n` +
    `- APK SHA-256: \`${apkSha256}\`\n` +
    `- Evaluated hardware: ${performance.hardware.join('; ')}\n` +
    `- Model: ${performance.model.name} ${performance.model.quantization} with QVAC SDK ${performance.model.qvacSdkVersion}\n` +
    `- [Demo video](${videoUrl})\n\n` +
    `Verify the APK with the attached \`clik2trip-sovereign.apk.sha256\` before installing. This release uses testnet assets only.\n`,
);

console.log(`Release metadata ready for ${tag}; APK ${apk.byteLength} bytes`);
