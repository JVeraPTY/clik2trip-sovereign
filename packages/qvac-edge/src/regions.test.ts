import { describe, expect, it } from 'vitest';

import { demoTourCatalog } from './demo-catalog.js';
import {
  coarsenCoordinates,
  demoRegions,
  distanceKm,
  fallbackRegionId,
  neighbourRadiusKm,
  regionById,
  resolveRegion,
} from './regions.js';
import { documentsForRegions, localTourCatalog, toursForRegions } from './tourism.js';

/** Roughly the centre of Panama City, the location this demo was built around. */
const panamaCity = { lat: 8.9824, lng: -79.5199 };

describe('region geometry', () => {
  it('measures a known distance to within a kilometre', () => {
    // Panama City to David, Chiriquí: about 325 km great-circle.
    expect(distanceKm(panamaCity, { lat: 8.4333, lng: -82.4333 })).toBeCloseTo(325, -1);
  });

  it('returns zero for a point measured against itself', () => {
    expect(distanceKm(panamaCity, panamaCity)).toBe(0);
  });

  it('coarsens a fix to a neighbourhood before anything downstream sees it', () => {
    expect(coarsenCoordinates({ lat: 8.98243917, lng: -79.51992348 })).toEqual({
      lat: 9,
      lng: -79.5,
    });
  });

  it('gives every region a unique id and a usable radius', () => {
    const ids = demoRegions.map((region) => region.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const region of demoRegions) {
      expect(region.radiusKm).toBeGreaterThan(0);
    }
  });

  it('keeps the fallback region resolvable', () => {
    expect(regionById(fallbackRegionId)).not.toBeNull();
    expect(regionById('no-such-region')).toBeNull();
  });
});

describe('resolveRegion', () => {
  it('places a traveler in Panama City and offers the reachable neighbours', () => {
    const resolved = resolveRegion(panamaCity);
    expect(resolved.source).toBe('device');
    expect(resolved.region.id).toBe('panama-city');
    // The Pacific islands, Coclé and Portobelo are ordinary day trips from here.
    expect(resolved.regionIds).toContain('panama-oeste');
    expect(resolved.regionIds).toContain('cocle');
    expect(resolved.regionIds).toContain('colon');
    // Chiriquí is on the other side of the country and must not be offered.
    expect(resolved.regionIds).not.toContain('chiriqui');
  });

  it('lists the resolved region first, then neighbours by distance', () => {
    const { regionIds } = resolveRegion(panamaCity);
    expect(regionIds[0]).toBe('panama-city');
  });

  it('never offers a neighbour beyond the neighbour radius', () => {
    const resolved = resolveRegion(panamaCity);
    for (const id of resolved.regionIds.slice(1)) {
      const region = regionById(id);
      expect(region).not.toBeNull();
      expect(distanceKm(panamaCity, region!.centroid)).toBeLessThanOrEqual(neighbourRadiusKm);
    }
  });

  it('falls back rather than claiming a region an ocean away', () => {
    const resolved = resolveRegion({ lat: 48.8566, lng: 2.3522 });
    expect(resolved.source).toBe('fallback');
    expect(resolved.region.id).toBe(fallbackRegionId);
    expect(resolved.distanceKm).toBeNull();
  });

  it('falls back when no fix is available at all', () => {
    expect(resolveRegion(null).source).toBe('fallback');
  });

  it('resolves Boquete to Chiriquí, not to the fallback', () => {
    expect(resolveRegion({ lat: 8.78, lng: -82.44 }).region.id).toBe('chiriqui');
  });
});

describe('region-scoped snapshot', () => {
  it('always carries the four bookable Clik2Trip tours, wherever the phone is', () => {
    for (const region of demoRegions) {
      const refIds = toursForRegions([region.id]).map((tour) => tour.tourRefId);
      for (const bookable of localTourCatalog) {
        expect(refIds).toContain(bookable.tourRefId);
      }
    }
  });

  it('includes the demo entries of the requested region and no others', () => {
    const tours = toursForRegions(['guna-yala']);
    const demoOnly = tours.filter((tour) => tour.source === 'demo-seed');
    expect(demoOnly.length).toBeGreaterThan(0);
    for (const tour of demoOnly) {
      expect(tour.regionId).toBe('guna-yala');
    }
  });

  it('gives a Panama City traveler a corpus worth retrieving from', () => {
    const { regionIds } = resolveRegion(panamaCity);
    const documents = documentsForRegions(regionIds);
    expect(documents.length).toBeGreaterThanOrEqual(25);
    expect(new Set(documents).size).toBe(documents.length);
  });

  it('recommends the Otoque day trip to a traveler standing in Panama City', () => {
    const { regionIds } = resolveRegion(panamaCity);
    const slugs = toursForRegions(regionIds).map((tour) => tour.slug);
    expect(slugs).toContain('isla-otoque-dia-completo');
    expect(slugs).toContain('kitesurf-punta-chame');
  });

  it('ignores an unknown region rather than leaking every demo entry', () => {
    const tours = toursForRegions(['no-such-region']);
    expect(tours.every((tour) => tour.source === 'clik2trip')).toBe(true);
  });
});

describe('demo catalog integrity', () => {
  it('marks every entry as demonstration data, never as Clik2Trip inventory', () => {
    for (const tour of demoTourCatalog) {
      expect(tour.source).toBe('demo-seed');
      expect(tour.tourRefId.startsWith('demo-')).toBe(true);
    }
  });

  it('gives every entry a unique reference and slug', () => {
    const refIds = demoTourCatalog.map((tour) => tour.tourRefId);
    const slugs = demoTourCatalog.map((tour) => tour.slug);
    expect(new Set(refIds).size).toBe(refIds.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('never collides with a Clik2Trip reference id', () => {
    const bookable = new Set(localTourCatalog.map((tour) => tour.tourRefId));
    for (const tour of demoTourCatalog) {
      expect(bookable.has(tour.tourRefId)).toBe(false);
    }
  });

  it('gives every entry a price, a geography and a known region', () => {
    const knownRegions = new Set(demoRegions.map((region) => region.id));
    for (const tour of demoTourCatalog) {
      expect(tour.priceFrom).toBeGreaterThan(0);
      expect(tour.currency).toBe('USD');
      expect(tour.geo).toBeDefined();
      expect(tour.regionId).toBeDefined();
      expect(knownRegions.has(tour.regionId!)).toBe(true);
    }
  });

  it('places every entry within its own region', () => {
    for (const tour of demoTourCatalog) {
      const region = regionById(tour.regionId!);
      expect(region).not.toBeNull();
      expect(distanceKm(tour.geo!, region!.centroid)).toBeLessThanOrEqual(region!.radiusKm);
    }
  });

  it('withholds a price from the bookable tours, where the Gateway decides it', () => {
    for (const tour of localTourCatalog) {
      expect(tour.priceFrom).toBeUndefined();
      expect(tour.source).toBe('clik2trip');
    }
  });

  it('gives every entry search terms in both languages the model may produce', () => {
    for (const tour of demoTourCatalog) {
      expect(tour.searchTerms.length).toBeGreaterThanOrEqual(6);
    }
  });
});
