import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

import { connectivityStatus, type ConnectivityStatus } from './connectivity';

/**
 * Live connectivity for the header. It reads the current state once and then
 * follows `expo-network`'s subscription, so flipping airplane mode updates the
 * icon without any user action.
 */
export function useConnectivity(): ConnectivityStatus {
  const [status, setStatus] = useState<ConnectivityStatus>('UNKNOWN');

  useEffect(() => {
    let active = true;

    Network.getNetworkStateAsync()
      .then((state) => {
        if (active) setStatus(connectivityStatus(state));
      })
      .catch(() => {
        // Leave the status unknown rather than claiming either answer.
      });

    const subscription = Network.addNetworkStateListener((state) => {
      if (active) setStatus(connectivityStatus(state));
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return status;
}
