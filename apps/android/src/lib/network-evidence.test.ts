import { describe, expect, it } from 'vitest';

import { isDefinitelyOffline, remainedOffline } from './network-evidence';

const offline = {
  type: 'NONE',
  isConnected: false,
  isInternetReachable: false,
};

describe('offline evidence', () => {
  it('accepts a confirmed no-network snapshot', () => {
    expect(isDefinitelyOffline(offline)).toBe(true);
  });

  it('rejects connected and indeterminate snapshots', () => {
    expect(isDefinitelyOffline({ type: 'WIFI', isConnected: true, isInternetReachable: true })).toBe(false);
    expect(isDefinitelyOffline({ type: 'UNKNOWN' })).toBe(false);
  });

  it('requires offline snapshots at both boundaries and no connection event', () => {
    expect(remainedOffline(offline, offline, false)).toBe(true);
    expect(remainedOffline(offline, offline, true)).toBe(false);
    expect(remainedOffline(offline, { type: 'WIFI', isConnected: true }, false)).toBe(false);
  });
});
