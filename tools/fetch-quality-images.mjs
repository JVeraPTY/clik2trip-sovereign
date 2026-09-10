import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const qualityRoot = resolve(repositoryRoot, 'evaluation/quality');
const imageRoot = resolve(qualityRoot, 'images');
const sourceManifest = JSON.parse(await readFile(resolve(qualityRoot, 'sources.json'), 'utf8'));

if (sourceManifest.schemaVersion !== 1 || sourceManifest.cases?.length !== 20) {
  throw new Error('QUALITY_SOURCE_MANIFEST_MUST_CONTAIN_20_CASES');
}

await mkdir(imageRoot, { recursive: true });
const lockedCases = [];
for (const item of sourceManifest.cases) {
  if (!/^quality-\d{3}$/.test(item.id)) throw new Error(`INVALID_CASE_ID: ${item.id}`);
  const response = await fetch(item.imageUrl, {
    headers: { 'User-Agent': 'Clik2TripSovereignEvaluation/0.1 (github.com/JVeraPTY/clik2trip-sovereign)' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`IMAGE_DOWNLOAD_FAILED: ${item.id} ${response.status}`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) throw new Error(`NOT_AN_IMAGE: ${item.id}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > 15_000_000) {
    throw new Error(`IMAGE_SIZE_OUT_OF_RANGE: ${item.id} ${bytes.byteLength}`);
  }
  const finalPath = resolve(imageRoot, `${item.id}.jpg`);
  const temporaryPath = `${finalPath}.download`;
  await writeFile(temporaryPath, bytes);
  await rename(temporaryPath, finalPath);
  lockedCases.push({
    ...item,
    imageFile: `images/${item.id}.jpg`,
    imageSha256: createHash('sha256').update(bytes).digest('hex'),
    imageBytes: bytes.byteLength,
  });
  console.log(`${item.id}: ${bytes.byteLength} bytes`);
}

const lockedManifest = {
  schemaVersion: 1,
  frozenBeforeInferenceAt: sourceManifest.frozenBeforeInferenceAt,
  prompt: sourceManifest.prompt,
  cases: lockedCases,
};
await writeFile(resolve(qualityRoot, 'cases.json'), `${JSON.stringify(lockedManifest, null, 2)}\n`);
console.log('Wrote evaluation/quality/cases.json');
