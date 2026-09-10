import {
  Clik2TripGraphQlClient,
  type CatalogExperience,
} from '@clik2trip/cliktotrip-client';
import { useEffect, useMemo, useState } from 'react';

const defaultGateway = 'https://www.clik2trip.com/graphql';

function errorCode(cause: unknown): string {
  if (cause && typeof cause === 'object' && 'code' in cause) return String(cause.code);
  return cause instanceof Error ? cause.message : 'CLIK2TRIP_REQUEST_FAILED';
}

/**
 * The Clik2Trip catalogue, read once through the Gateway. It is kept here
 * rather than inside the list so a recommendation can reuse the same entries
 * for its own card without asking the network a second time.
 */
export function useExperienceCatalog() {
  const client = useMemo(
    () =>
      new Clik2TripGraphQlClient({
        endpoint: process.env.EXPO_PUBLIC_CLIKTOTRIP_GATEWAY ?? defaultGateway,
      }),
    [],
  );
  const [experiences, setExperiences] = useState<CatalogExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    client
      .searchExperiences({ locale: 'es', pageSize: 20 })
      .then((items) => {
        if (active) setExperiences(items);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorCode(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client]);

  return { experiences, loading, error };
}
