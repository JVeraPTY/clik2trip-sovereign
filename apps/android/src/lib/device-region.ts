import { coarsenCoordinates, type RegionResolution } from '@clik2trip/qvac-edge';
import type { GeoPoint } from '@clik2trip/contracts';

/** The shape `expo-location` returns, narrowed to what this app reads. */
export interface DevicePosition {
  coords: { latitude: number; longitude: number };
}

/**
 * Turns a device fix into the only geography this app keeps: a coarse point,
 * rounded before it leaves this function. A fix with values outside the valid
 * range is discarded rather than clamped — a nonsensical position must resolve
 * to no region at all, not to whatever lies at the edge of the world.
 */
export function coarseFix(position: DevicePosition | null): GeoPoint | null {
  if (!position) return null;
  const { latitude, longitude } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return coarsenCoordinates({ lat: latitude, lng: longitude });
}

/** The line under the results, saying which place these experiences belong to. */
export function regionNotice(resolution: RegionResolution | null): string {
  if (!resolution) return 'Resolviendo tu zona…';
  if (resolution.source === 'fallback') {
    return `Sin ubicación: mostrando ${resolution.region.name}`;
  }
  return `Experiencias cerca de ${resolution.region.name}`;
}
