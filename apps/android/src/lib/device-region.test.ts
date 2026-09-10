import { describe, expect, it } from 'vitest';

import { coarseFix, regionNotice } from './device-region';
import { resolveRegion } from '@clik2trip/qvac-edge';

describe('coarseFix', () => {
  it('rounds a precise fix down to a neighbourhood', () => {
    expect(coarseFix({ coords: { latitude: 8.98243917, longitude: -79.51992348 } })).toEqual({
      lat: 9,
      lng: -79.5,
    });
  });

  it('returns nothing when there is no fix', () => {
    expect(coarseFix(null)).toBeNull();
  });

  it('discards an impossible fix rather than clamping it to the edge of the world', () => {
    expect(coarseFix({ coords: { latitude: 91, longitude: 0 } })).toBeNull();
    expect(coarseFix({ coords: { latitude: 0, longitude: -181 } })).toBeNull();
    expect(coarseFix({ coords: { latitude: Number.NaN, longitude: 0 } })).toBeNull();
  });
});

describe('regionNotice', () => {
  it('names the place the experiences belong to', () => {
    expect(regionNotice(resolveRegion({ lat: 8.98, lng: -79.52 }))).toBe(
      'Experiencias cerca de Ciudad de Panamá',
    );
  });

  it('says plainly when no location was available', () => {
    expect(regionNotice(resolveRegion(null))).toBe('Sin ubicación: mostrando Ciudad de Panamá');
  });

  it('says it is still working before a region resolves', () => {
    expect(regionNotice(null)).toBe('Resolviendo tu zona…');
  });
});
