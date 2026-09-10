import { Clik2TripGraphQlClient } from '@clik2trip/cliktotrip-client';
import { useMemo } from 'react';

const defaultGateway = 'https://www.clik2trip.com/graphql';

/** The one place the Gateway endpoint is read, so it is configured once. */
export function useGatewayClient(): Clik2TripGraphQlClient {
  return useMemo(
    () =>
      new Clik2TripGraphQlClient({
        endpoint: process.env.EXPO_PUBLIC_CLIKTOTRIP_GATEWAY ?? defaultGateway,
      }),
    [],
  );
}
