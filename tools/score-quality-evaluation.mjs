import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const qualityRoot = resolve(repositoryRoot, 'evaluation/quality');
const strict = process.argv.includes('--strict');
const cases = JSON.parse(await readFile(resolve(qualityRoot, 'cases.json'), 'utf8'));
const failures = [];

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function exactMatch(actual, accepted) {
  const normalized = normalize(actual);
  return accepted.map(normalize).includes(normalized);
}

function average(values) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 1 : numerator / denominator;
}

async function verifyCases() {
  if (cases.schemaVersion !== 1 || cases.cases?.length < 20) {
    failures.push(`need at least 20 frozen cases, found ${cases.cases?.length ?? 0}`);
    return;
  }
  const ids = new Set();
  for (const item of cases.cases) {
    if (ids.has(item.id)) failures.push(`duplicate case ${item.id}`);
    ids.add(item.id);
    if (!item.expected?.acceptedCategories?.length || !item.expected?.topRecommendationIds?.length) {
      failures.push(`${item.id} lacks expected category or recommendation criteria`);
    }
    if (!item.sourcePage || !item.creator || !item.license || !item.licenseUrl) {
      failures.push(`${item.id} lacks reusable-source attribution`);
    }
    try {
      const bytes = await readFile(resolve(qualityRoot, item.imageFile));
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (digest !== item.imageSha256 || bytes.byteLength !== item.imageBytes) {
        failures.push(`${item.id} image digest or size does not match cases.json`);
      }
    } catch {
      failures.push(`${item.id} image is missing`);
    }
  }
}

await verifyCases();

let results = [];
try {
  results = (await readFile(resolve(qualityRoot, 'results.jsonl'), 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`invalid JSON on results.jsonl line ${index + 1}`);
      }
    });
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const caseById = new Map(cases.cases.map((item) => [item.id, item]));
const resultById = new Map();
const forbiddenFields = ['image', 'imagePath', 'prompt', 'promptBody', 'walletAddress', 'seedPhrase', 'privateKey'];
for (const result of results) {
  if (!result?.caseId || resultById.has(result.caseId)) {
    failures.push(`result has a missing or duplicate caseId: ${result?.caseId ?? 'missing'}`);
    continue;
  }
  let valid = true;
  const expectedCase = caseById.get(result.caseId);
  if (!expectedCase) {
    failures.push(`result references unknown case ${result.caseId}`);
    valid = false;
  }
  if (expectedCase && result.imageSha256 !== expectedCase.imageSha256) {
    failures.push(`${result.caseId} result references the wrong image digest`);
    valid = false;
  }
  if (forbiddenFields.some((field) => Object.hasOwn(result, field))) {
    failures.push(`${result.caseId} contains a privacy-forbidden field`);
    valid = false;
  }
  if (result.promptHash !== cases.prompt.sha256 || result.promptCategory !== cases.prompt.category) {
    failures.push(`${result.caseId} does not use the frozen prompt identity`);
    valid = false;
  }
  if (!result.actual || !Array.isArray(result.actual.restrictions) || !Array.isArray(result.recommendationIds)) {
    failures.push(`${result.caseId} lacks structured output or recommendations`);
    valid = false;
  }
  if (typeof result.success !== 'boolean' || typeof result.explanationGrounded !== 'boolean') {
    failures.push(`${result.caseId} lacks success or explanation review`);
    valid = false;
  }
  if (result.success === false) failures.push(`${result.caseId} inference failed`);
  if (valid) resultById.set(result.caseId, result);
}

if (resultById.size !== cases.cases.length) {
  failures.push(`need ${cases.cases.length} unique results, found ${resultById.size}`);
}

const scored = [];
for (const item of cases.cases) {
  const result = resultById.get(item.id);
  if (!result) continue;
  const actual = result.actual;
  const categoryCorrect = result.success && exactMatch(actual.category, item.expected.acceptedCategories);
  const destinationCorrect = result.success && (item.expected.destination.visibility === 'not-visible'
    ? normalize(actual.destination) === ''
    : exactMatch(actual.destination, item.expected.destination.acceptedValues));
  const durationCorrect = result.success && (item.expected.duration.mode === 'unknown'
    ? actual.durationMinutes === null || actual.durationMinutes === 0
    : Math.abs(actual.durationMinutes - item.expected.duration.minutes) <= item.expected.duration.toleranceMinutes);
  const expectedRestrictions = new Set(item.expected.restrictions.map(normalize));
  const actualRestrictions = new Set(actual.restrictions.map(normalize).filter(Boolean));
  const truePositives = [...actualRestrictions].filter((value) => expectedRestrictions.has(value)).length;
  const restrictionPrecision = result.success ? ratio(truePositives, actualRestrictions.size) : 0;
  const restrictionRecall = result.success ? ratio(truePositives, expectedRestrictions.size) : 0;
  const topOneCorrect = result.success && item.expected.topRecommendationIds.includes(result.recommendationIds[0]);
  const topThreeCorrect = result.success && result.recommendationIds
    .slice(0, 3)
    .some((id) => item.expected.topRecommendationIds.includes(id));
  scored.push({
    caseId: item.id,
    success: result.success,
    categoryCorrect,
    destinationCorrect,
    durationCorrect,
    restrictionPrecision,
    restrictionRecall,
    topOneCorrect,
    topThreeCorrect,
    explanationGrounded: result.success && result.explanationGrounded,
    confidence: actual.confidence,
  });
}

const successful = scored.filter((item) => item.success);
const categoryOutcomes = scored.map((item) => (item.categoryCorrect ? 1 : 0));
const confidencePairs = successful.filter((item) => Number.isFinite(item.confidence));
const report = {
  schemaVersion: 1,
  status: failures.length === 0 ? 'complete' : 'incomplete',
  frozenBeforeInferenceAt: cases.frozenBeforeInferenceAt,
  prompt: cases.prompt,
  cases: cases.cases.length,
  results: resultById.size,
  successfulResults: successful.length,
  metrics: {
    categoryAccuracy: average(categoryOutcomes),
    destinationExactOrNotVisibleAccuracy: average(scored.map((item) => (item.destinationCorrect ? 1 : 0))),
    durationAccuracy: average(scored.map((item) => (item.durationCorrect ? 1 : 0))),
    restrictionPrecision: average(scored.map((item) => item.restrictionPrecision)),
    restrictionRecall: average(scored.map((item) => item.restrictionRecall)),
    top1RecommendationAccuracy: average(scored.map((item) => (item.topOneCorrect ? 1 : 0))),
    top3RecommendationAccuracy: average(scored.map((item) => (item.topThreeCorrect ? 1 : 0))),
    explanationGroundingRate: average(scored.map((item) => (item.explanationGrounded ? 1 : 0))),
    confidenceBrierScore: average(confidencePairs.map((item) => (item.confidence - (item.categoryCorrect ? 1 : 0)) ** 2)),
    meanConfidenceWhenCategoryCorrect: average(confidencePairs.filter((item) => item.categoryCorrect).map((item) => item.confidence)),
    meanConfidenceWhenCategoryIncorrect: average(confidencePairs.filter((item) => !item.categoryCorrect).map((item) => item.confidence)),
  },
  caseResults: scored,
  validationErrors: failures,
};

await writeFile(resolve(qualityRoot, 'quality-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Quality report: ${report.status}; ${resultById.size}/${cases.cases.length} results`);
if (strict && failures.length > 0) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
