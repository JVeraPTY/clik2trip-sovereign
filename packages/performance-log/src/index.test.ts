import { describe, expect, it } from 'vitest';

import { createPerformanceRecord, percentile, summarizePerformance } from './index.js';

function record(ttftMs: number, tokensPerSecond: number) {
  return createPerformanceRecord({
    recordedAt: '2026-09-09T15:00:00.000Z',
    deviceModel: 'Physical Android test device',
    androidVersion: '12',
    loadMs: 100,
    promptHash: 'a'.repeat(64),
    promptCategory: 'tourism-image-extraction-v1',
    timeToFirstToken: ttftMs,
    tokensPerSecond,
    totalMs: 300,
    emittedTokens: 12,
    success: true,
    offline: true,
  });
}

describe('performance evidence', () => {
  it('creates a record without image or prompt body fields', () => {
    const result = record(200, 9);
    expect(result).not.toHaveProperty('image');
    expect(result).not.toHaveProperty('prompt');
    expect(result.modelBytes).toBe(411925632);
  });

  it('summarizes median and p95 reproducibly', () => {
    expect(summarizePerformance([record(100, 8), record(200, 9), record(300, 10)])).toEqual({
      runs: 3,
      successfulRuns: 3,
      medianTtftMs: 200,
      p95TtftMs: 300,
      medianTokensPerSecond: 9,
      p95TokensPerSecond: 10,
      medianLoadMs: 100,
      p95LoadMs: 100,
    });
  });

  it('uses the nearest-rank percentile and refuses invalid ranks', () => {
    expect(percentile([4, 1, 3, 2], 0.5)).toBe(2);
    expect(percentile([4, 1, 3, 2], 0.95)).toBe(4);
    expect(() => percentile([1], 0)).toThrow('PERCENTILE_RANK_OUT_OF_RANGE');
  });
});
