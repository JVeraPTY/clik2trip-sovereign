import { describe, expect, it } from 'vitest';

import { analysisPhaseLabel, formatElapsed } from './inference-phase';

describe('inference phase labels', () => {
  it('formats elapsed time as minutes and seconds', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(9_400)).toBe('0:09');
    expect(formatElapsed(94_681)).toBe('1:34');
    expect(formatElapsed(-5)).toBe('0:00');
  });

  it('distinguishes waiting for the first token from streaming', () => {
    expect(analysisPhaseLabel(0)).toBe('Interpretando la imagen en el dispositivo');
    expect(analysisPhaseLabel(120)).toContain('120 caracteres');
  });
});
