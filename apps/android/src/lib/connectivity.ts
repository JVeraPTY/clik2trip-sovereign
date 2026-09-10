import type { ConnectivitySnapshot } from './network-evidence';

export type ConnectivityStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

/**
 * Status for the interface, deliberately separate from `isDefinitelyOffline`.
 * That one answers an evidence question — "can this run be recorded as
 * offline?" — and so refuses to call anything offline unless the device says
 * so unambiguously. This one answers a display question, where an unresolved
 * state is worth showing as its own thing rather than claiming a connection.
 */
export function connectivityStatus(snapshot: ConnectivitySnapshot): ConnectivityStatus {
  if (snapshot.isConnected === true && snapshot.isInternetReachable !== false) {
    return 'ONLINE';
  }
  if (snapshot.isConnected === false || snapshot.type === 'NONE') return 'OFFLINE';
  if (snapshot.isInternetReachable === false) return 'OFFLINE';
  return 'UNKNOWN';
}

export function connectivityLabel(status: ConnectivityStatus): string {
  if (status === 'ONLINE') return 'Con conexión';
  if (status === 'OFFLINE') return 'Sin conexión';
  return 'Conexión desconocida';
}
