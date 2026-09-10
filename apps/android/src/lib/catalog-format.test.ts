import { describe, expect, it } from 'vitest';

import {
  confirmationLabel,
  experienceFootnote,
  formatDuration,
  formatPriceFrom,
} from './catalog-format';

describe('catalogue card formatting', () => {
  it('shows whole hours the way the site does', () => {
    expect(formatDuration(240)).toBe('4 h');
    expect(formatDuration(300)).toBe('5 h');
    expect(formatDuration(480)).toBe('8 h');
  });

  it('keeps the remainder when a tour is not a whole number of hours', () => {
    expect(formatDuration(90)).toBe('1 h 30 min');
    expect(formatDuration(45)).toBe('45 min');
  });

  it('has nothing to show when the gateway reports no duration', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(0)).toBeNull();
  });

  it('drops trailing decimals on a round price and keeps real ones', () => {
    expect(formatPriceFrom(95, 'USD')).toBe('USD 95');
    expect(formatPriceFrom(129, 'USD')).toBe('USD 129');
    expect(formatPriceFrom(75.5, 'USD')).toBe('USD 75.50');
  });

  it('labels both confirmation types', () => {
    expect(confirmationLabel('INMEDIATA')).toBe('Confirmación inmediata');
    expect(confirmationLabel('PENDIENTE')).toBe('Sujeto a confirmación');
  });

  it('builds the footnote, and omits the duration when there is none', () => {
    expect(experienceFootnote(240, 'Arenal Expediciones')).toBe('4 h · Arenal Expediciones');
    expect(experienceFootnote(null, 'Arenal Expediciones')).toBe('Arenal Expediciones');
  });
});
