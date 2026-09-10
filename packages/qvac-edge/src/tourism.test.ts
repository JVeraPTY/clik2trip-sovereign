import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  buildTourismQuery,
  extractionPrompt,
  localTourCatalog,
  parseTourDocument,
  parseVisionAnalysis,
  visionAnalysisJsonSchema,
  visionPsyPrompt,
} from './tourism.js';

describe('VisionPsy tourism extraction', () => {
  it('pins the exact prompt recorded in performance evidence', () => {
    expect(createHash('sha256').update(extractionPrompt).digest('hex')).toBe(visionPsyPrompt.sha256);
  });

  it('parses the compact response without inventing missing values', () => {
    const analysis = parseVisionAnalysis(
      '```json\n{"c":"hiking","d":null,"m":null,"a":[],"r":["steep"],"p":0.82,"e":["trail"]}\n```',
    );
    expect(analysis).toEqual({
      category: 'hiking',
      destination: null,
      durationMinutes: null,
      accessibilitySignals: [],
      restrictions: ['steep'],
      confidence: 0.82,
      evidence: ['trail'],
    });
  });

  it('maps schema sentinels to unknown values', () => {
    const analysis = parseVisionAnalysis(
      '{"c":"beach","d":"","m":0,"a":[],"r":[],"p":0.6,"e":["sand"]}',
    );
    expect(analysis?.destination).toBeNull();
    expect(analysis?.durationMinutes).toBeNull();
  });

  it('pins every compact field in the native JSON schema', () => {
    expect(visionAnalysisJsonSchema.required).toEqual(['c', 'd', 'm', 'a', 'r', 'p', 'e']);
    expect(visionAnalysisJsonSchema.additionalProperties).toBe(false);
  });

  it('returns null for truncated or invalid model output', () => {
    expect(parseVisionAnalysis('{"c":"hiking"')).toBeNull();
    expect(parseVisionAnalysis('{"c":"hiking"}')).toBeNull();
  });

  it('builds a bounded local query from structured evidence', () => {
    const analysis = parseVisionAnalysis(
      '{"c":"surf","d":"Tamarindo","m":120,"a":[],"r":[],"p":0.9,"e":["waves"]}',
    );
    expect(buildTourismQuery(analysis, 'unused')).toBe('surf Tamarindo waves');
  });
});

describe('local catalog snapshot', () => {
  it('contains only the four tours from approved seed providers', () => {
    expect(localTourCatalog.map((tour) => tour.tourRefId)).toEqual([
      'tour-rafting-pacuare',
      'tour-surf-tamarindo',
      'tour-volcan-arenal',
      'tour-termales-privados',
    ]);
  });

  it('round-trips a RAG document through the public contract', () => {
    const first = localTourCatalog[0];
    expect(first).toBeDefined();
    expect(parseTourDocument(JSON.stringify(first))).toEqual(first);
  });
});
