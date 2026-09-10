import { resolveRegion, type RegionResolution } from '@clik2trip/qvac-edge';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

import { coarseFix, type DevicePosition } from './device-region';

export type RegionStatus = 'PENDING' | 'RESOLVING' | 'READY';

/** A fix that never arrives must not hold the onboarding open indefinitely. */
const fixTimeoutMs = 8000;

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Resolves which region's catalog this device should load, from a coarse fix
 * taken once at start-up.
 *
 * A refused permission, a disabled radio or a fix that never arrives are all
 * ordinary outcomes here, not failures: each resolves to the fallback region so
 * the demonstration still runs. Only the resolved region name is ever kept —
 * the coordinates are coarsened on arrival, used to pick a region, and dropped.
 * Nothing is stored, logged or sent anywhere.
 */
export function useDeviceRegion() {
  const [status, setStatus] = useState<RegionStatus>('PENDING');
  const [resolution, setResolution] = useState<RegionResolution | null>(null);

  const resolve = useCallback(async () => {
    setStatus('RESOLVING');
    let fix: DevicePosition | null = null;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.granted) {
        // A cached fix is preferred: it is instant and, at this precision, just
        // as good as making the radio work for a fresh one.
        fix =
          (await Location.getLastKnownPositionAsync({ maxAge: 600_000 })) ??
          (await withTimeout(
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
            fixTimeoutMs,
          ));
      }
    } catch {
      // Location services off, no provider, radio busy. The fallback covers it.
    }
    const resolved = resolveRegion(coarseFix(fix));
    setResolution(resolved);
    setStatus('READY');
    return resolved;
  }, []);

  return { status, resolution, resolve };
}
