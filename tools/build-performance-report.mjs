import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evaluationRoot = resolve(repositoryRoot, 'evaluation');
const strict = process.argv.includes('--strict');
const outputArgumentIndex = process.argv.indexOf('--output');
const outputPath = resolve(
  repositoryRoot,
  outputArgumentIndex >= 0
    ? (process.argv[outputArgumentIndex + 1] ?? 'evaluation/performance-report.json')
    : 'evaluation/performance-report.json',
);

const requiredStringFields = [
  'recordedAt',
  'deviceModel',
  'androidVersion',
  'qvacSdkVersion',
  'modelName',
  'quantization',
  'promptHash',
  'promptCategory',
  'backendDevice',
];
const requiredNumberFields = [
  'modelBytes',
  'loadMs',
  'promptTokens',
  'outputTokens',
  'ttftMs',
  'totalMs',
  'tokensPerSecond',
];
const forbiddenKeys = new Set([
  'customerEmail',
  'customerName',
  'email',
  'image',
  'imagePath',
  'mnemonic',
  'privateKey',
  'prompt',
  'promptBody',
  'seed',
  'seedPhrase',
  'walletAddress',
]);

function fail(message) {
  throw new Error(`PERFORMANCE_REPORT_INVALID: ${message}`);
}

function assertPrivacySafe(value, trail = 'record') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) fail(`${trail} contains forbidden field ${key}`);
    assertPrivacySafe(child, `${trail}.${key}`);
  }
}

function validateRecord(record, file) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    fail(`${file} is not an object`);
  }
  if (record.schemaVersion !== 1) fail(`${file} has an unsupported schemaVersion`);
  for (const field of requiredStringFields) {
    if (typeof record[field] !== 'string' || record[field].length === 0) {
      fail(`${file} has an invalid ${field}`);
    }
  }
  for (const field of requiredNumberFields) {
    if (typeof record[field] !== 'number' || !Number.isFinite(record[field]) || record[field] < 0) {
      fail(`${file} has an invalid ${field}`);
    }
  }
  if (!/^[0-9a-f]{64}$/.test(record.promptHash)) fail(`${file} has an invalid promptHash`);
  if (typeof record.success !== 'boolean' || typeof record.offline !== 'boolean') {
    fail(`${file} has invalid success or offline flags`);
  }
  assertPrivacySafe(record, file);
  return record;
}

function percentile(values, rank) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(rank * sorted.length) - 1)];
}

function summarize(entries) {
  const successful = entries.map((entry) => entry.record).filter((record) => record.success);
  return {
    runs: entries.length,
    successfulRuns: successful.length,
    medianLoadMs: percentile(successful.map((record) => record.loadMs), 0.5),
    p95LoadMs: percentile(successful.map((record) => record.loadMs), 0.95),
    medianTtftMs: percentile(successful.map((record) => record.ttftMs), 0.5),
    p95TtftMs: percentile(successful.map((record) => record.ttftMs), 0.95),
    medianTokensPerSecond: percentile(
      successful.map((record) => record.tokensPerSecond),
      0.5,
    ),
    p95TokensPerSecond: percentile(
      successful.map((record) => record.tokensPerSecond),
      0.95,
    ),
  };
}

const manifestPath = resolve(evaluationRoot, 'performance-runs.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.runs)) fail('invalid manifest');

const seenFiles = new Set();
const entries = [];
for (const item of manifest.runs) {
  if (!item || !['cold', 'warm'].includes(item.kind) || typeof item.file !== 'string') {
    fail('every manifest run needs kind cold|warm and a file');
  }
  if (seenFiles.has(item.file)) fail(`duplicate run ${item.file}`);
  seenFiles.add(item.file);
  const absolutePath = resolve(evaluationRoot, item.file);
  if (!absolutePath.startsWith(`${evaluationRoot}/`)) fail(`run escapes evaluation/: ${item.file}`);
  const record = validateRecord(JSON.parse(await readFile(absolutePath, 'utf8')), item.file);
  entries.push({ kind: item.kind, file: item.file, record });
}

if (typeof manifest.qualityResultsFile === 'string') {
  const qualityPath = resolve(evaluationRoot, manifest.qualityResultsFile);
  try {
    const jsonLines = (await readFile(qualityPath, 'utf8'))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of jsonLines) {
      const record = JSON.parse(line);
      validateRecord(record, `${manifest.qualityResultsFile}#${record.caseId ?? 'unknown'}`);
      entries.push({
        kind: manifest.qualityRunKind ?? 'warm',
        file: `${manifest.qualityResultsFile}#${record.caseId ?? entries.length + 1}`,
        record,
      });
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const cold = entries.filter((entry) => entry.kind === 'cold');
const warm = entries.filter((entry) => entry.kind === 'warm');
const failures = [];
if (cold.length < manifest.requirements.coldRuns) {
  failures.push(`need ${manifest.requirements.coldRuns} cold run, found ${cold.length}`);
}
if (warm.length < manifest.requirements.warmRuns) {
  failures.push(`need ${manifest.requirements.warmRuns} warm runs, found ${warm.length}`);
}
if (entries.some((entry) => !entry.record.success)) failures.push('one or more listed runs failed');

const report = {
  schemaVersion: 1,
  status: failures.length === 0 ? 'complete' : 'incomplete',
  sourceRecordsThrough: entries
    .map((entry) => entry.record.recordedAt)
    .sort()
    .at(-1) ?? null,
  model: {
    qvacSdkVersion: entries[0]?.record.qvacSdkVersion ?? '0.19.0',
    name: entries[0]?.record.modelName ?? 'VisionPsy-Nano-460M-Flash',
    quantization: entries[0]?.record.quantization ?? 'Q4_K_M',
    bytes: entries[0]?.record.modelBytes ?? 411925632,
  },
  hardware: [...new Set(entries.map((entry) => `${entry.record.deviceModel}; Android ${entry.record.androidVersion}; ${entry.record.backendDevice}`))],
  requirements: manifest.requirements,
  observed: { coldRuns: cold.length, warmRuns: warm.length },
  metrics: {
    all: summarize(entries),
    cold: summarize(cold),
    warm: summarize(warm),
    offline: summarize(entries.filter((entry) => entry.record.offline)),
  },
  runs: entries.map((entry) => ({
    kind: entry.kind,
    file: entry.file,
    recordedAt: entry.record.recordedAt,
    promptHash: entry.record.promptHash,
    promptCategory: entry.record.promptCategory,
    promptTokens: entry.record.promptTokens,
    outputTokens: entry.record.outputTokens,
    loadMs: entry.record.loadMs,
    ttftMs: entry.record.ttftMs,
    totalMs: entry.record.totalMs,
    tokensPerSecond: entry.record.tokensPerSecond,
    offline: entry.record.offline,
    success: entry.record.success,
    errorCode: entry.record.errorCode,
  })),
  validationErrors: failures,
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Performance report: ${report.status}; ${cold.length} cold, ${warm.length} warm`);
console.log(`Wrote ${outputPath}`);
if (strict && failures.length > 0) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
