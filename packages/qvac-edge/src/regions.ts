import { geoPointSchema, type GeoPoint } from '@clik2trip/contracts';

/**
 * A demonstration region: a named cluster of destinations a traveler standing
 * near its centroid could plausibly reach in a day. Regions exist so the local
 * catalog snapshot can be scoped to where the phone actually is, instead of
 * ingesting every entry on every device.
 */
export interface DemoRegion {
  id: string;
  /** Shown to the traveler, so it reads like a place and not an identifier. */
  name: string;
  country: string;
  centroid: GeoPoint;
  /**
   * How far from the centroid this region still describes. Beyond every
   * region's radius the device is out of covered territory and the fallback
   * region is used instead.
   */
  radiusKm: number;
}

export const demoRegions: readonly DemoRegion[] = [
  {
    id: 'panama-city',
    name: 'Ciudad de Panamá',
    country: 'PA',
    centroid: { lat: 8.9824, lng: -79.5199 },
    radiusKm: 60,
  },
  {
    id: 'panama-oeste',
    name: 'Panamá Oeste',
    country: 'PA',
    centroid: { lat: 8.65, lng: -79.89 },
    radiusKm: 55,
  },
  {
    id: 'cocle',
    name: 'Coclé',
    country: 'PA',
    centroid: { lat: 8.6, lng: -80.13 },
    radiusKm: 60,
  },
  {
    id: 'colon',
    name: 'Colón y Costa Arriba',
    country: 'PA',
    centroid: { lat: 9.55, lng: -79.65 },
    radiusKm: 60,
  },
  {
    id: 'guna-yala',
    name: 'Guna Yala',
    country: 'PA',
    centroid: { lat: 9.57, lng: -78.95 },
    radiusKm: 80,
  },
  {
    id: 'chiriqui',
    name: 'Chiriquí',
    country: 'PA',
    centroid: { lat: 8.78, lng: -82.43 },
    radiusKm: 90,
  },
  {
    id: 'bocas-del-toro',
    name: 'Bocas del Toro',
    country: 'PA',
    centroid: { lat: 9.34, lng: -82.24 },
    radiusKm: 70,
  },
  {
    id: 'veraguas',
    name: 'Veraguas y Coiba',
    country: 'PA',
    centroid: { lat: 7.63, lng: -81.27 },
    radiusKm: 90,
  },
  {
    id: 'azuero',
    name: 'Península de Azuero',
    country: 'PA',
    centroid: { lat: 7.53, lng: -80.02 },
    radiusKm: 80,
  },
  {
    id: 'costa-rica-norte',
    name: 'La Fortuna y Arenal',
    country: 'CR',
    centroid: { lat: 10.47, lng: -84.64 },
    radiusKm: 90,
  },
  {
    id: 'costa-rica-caribe',
    name: 'Caribe de Costa Rica',
    country: 'CR',
    centroid: { lat: 9.99, lng: -83.04 },
    radiusKm: 90,
  },
  {
    id: 'costa-rica-guanacaste',
    name: 'Guanacaste',
    country: 'CR',
    centroid: { lat: 10.299, lng: -85.84 },
    radiusKm: 90,
  },
] as const;

export const fallbackRegionId = 'panama-city';

/**
 * How far a neighbouring region's centroid may sit from the device and still be
 * worth ingesting. Standing in Panama City this reaches the Pacific islands,
 * Coclé and Portobelo — all ordinary day trips from there — without dragging in
 * the other side of the country.
 */
export const neighbourRadiusKm = 150;

const earthRadiusKm = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in kilometres. */
export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Drops precision from a fix before anything else sees it. One decimal is
 * roughly 11 km — far finer than the 150 km decision it feeds, and coarse
 * enough that what the app holds in memory is a neighbourhood rather than a
 * person's doorstep. Nothing downstream ever receives the raw fix.
 */
export function coarsenCoordinates(point: GeoPoint, decimals = 1): GeoPoint {
  const factor = 10 ** decimals;
  return geoPointSchema.parse({
    lat: Math.round(point.lat * factor) / factor,
    lng: Math.round(point.lng * factor) / factor,
  });
}

export function regionById(regionId: string): DemoRegion | null {
  return demoRegions.find((region) => region.id === regionId) ?? null;
}

export interface RegionResolution {
  /** The region the traveler is standing in, or the fallback. */
  region: DemoRegion;
  /** That region plus the neighbours worth offering, nearest first. */
  regionIds: string[];
  /** `device` when a fix placed the traveler; `fallback` when none was usable. */
  source: 'device' | 'fallback';
  /** Kilometres to the resolved region's centroid, null without a fix. */
  distanceKm: number | null;
}

function fallbackResolution(): RegionResolution {
  const region = regionById(fallbackRegionId);
  if (!region) throw new Error('DEMO_FALLBACK_REGION_MISSING');
  return { region, regionIds: [region.id], source: 'fallback', distanceKm: null };
}

/**
 * Picks the region for a coarse fix. The nearest centroid wins, but only if the
 * device is actually inside that region's radius; a fix somewhere uncovered
 * falls back rather than claiming a region hundreds of kilometres away.
 */
export function resolveRegion(coordinates: GeoPoint | null): RegionResolution {
  if (!coordinates) return fallbackResolution();

  const ranked = demoRegions
    .map((region) => ({ region, km: distanceKm(coordinates, region.centroid) }))
    .sort((left, right) => left.km - right.km);

  const nearest = ranked[0];
  if (!nearest || nearest.km > nearest.region.radiusKm) return fallbackResolution();

  const regionIds = ranked
    .filter((entry) => entry.region.id === nearest.region.id || entry.km <= neighbourRadiusKm)
    .map((entry) => entry.region.id);

  return {
    region: nearest.region,
    regionIds,
    source: 'device',
    distanceKm: nearest.km,
  };
}
