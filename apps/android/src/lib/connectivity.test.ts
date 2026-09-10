import { describe, expect, it } from 'vitest';

import { connectivityLabel, connectivityStatus } from './connectivity';
import { isDefinitelyOffline } from './network-evidence';

describe('connectivity status for the interface', () => {
  it('reports a connection only when the device confirms one', () => {
    expect(connectivityStatus({ isConnected: true, isInternetReachable: true })).toBe('ONLINE');
    expect(connectivityStatus({ isConnected: true, type: 'WIFI' })).toBe('ONLINE');
  });

  it('reports no connection in airplane mode and when the internet is unreachable', () => {
    expect(
      connectivityStatus({ type: 'NONE', isConnected: false, isInternetReachable: false }),
    ).toBe('OFFLINE');
    expect(connectivityStatus({ isConnected: false })).toBe('OFFLINE');
    expect(connectivityStatus({ isConnected: true, isInternetReachable: false })).toBe('OFFLINE');
  });

  it('does not claim a connection it cannot confirm', () => {
    expect(connectivityStatus({})).toBe('UNKNOWN');
    expect(connectivityStatus({ type: 'WIFI' })).toBe('UNKNOWN');
  });

  it('stays independent of the stricter rule used for offline evidence', () => {
    // A device that only reports `isConnected: false` is offline enough to gray
    // the icon, but not unambiguous enough to record an offline evaluation run.
    const partial = { isConnected: false };

    expect(connectivityStatus(partial)).toBe('OFFLINE');
    expect(isDefinitelyOffline(partial)).toBe(false);
  });

  it('labels every status', () => {
    expect(connectivityLabel('ONLINE')).toBe('Con conexión');
    expect(connectivityLabel('OFFLINE')).toBe('Sin conexión');
    expect(connectivityLabel('UNKNOWN')).toBe('Conexión desconocida');
  });
});
