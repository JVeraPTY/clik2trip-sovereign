export interface ConnectivitySnapshot {
  type?: string;
  isConnected?: boolean;
  isInternetReachable?: boolean;
}

export function isDefinitelyOffline(snapshot: ConnectivitySnapshot): boolean {
  return (
    snapshot.type === 'NONE' &&
    snapshot.isConnected !== true &&
    snapshot.isInternetReachable !== true
  );
}

export function remainedOffline(
  initial: ConnectivitySnapshot,
  final: ConnectivitySnapshot,
  connectionObservedDuringRun: boolean,
): boolean {
  return (
    !connectionObservedDuringRun &&
    isDefinitelyOffline(initial) &&
    isDefinitelyOffline(final)
  );
}
