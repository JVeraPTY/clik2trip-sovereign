import { StyleSheet, View } from 'react-native';

import { connectivityLabel, type ConnectivityStatus } from '../lib/connectivity';
import { brand, radius } from '../theme/brand';

const barHeights = [7, 11, 15] as const;

/**
 * Signal bars drawn with plain views, because the project has no SVG renderer
 * and this needs no asset. Connected shows brand-coloured bars; anything else
 * greys them and draws a slash, so the state reads at a glance on a recording.
 */
export function ConnectivityIcon({ status }: { status: ConnectivityStatus }) {
  const online = status === 'ONLINE';
  return (
    <View
      accessibilityLabel={connectivityLabel(status)}
      accessibilityRole="image"
      style={[styles.badge, online ? styles.badgeOnline : styles.badgeOffline]}
    >
      <View style={styles.bars}>
        {barHeights.map((height) => (
          <View
            key={height}
            style={[
              styles.bar,
              { height },
              online ? styles.barOnline : styles.barOffline,
            ]}
          />
        ))}
      </View>
      {online ? null : <View style={styles.slash} />}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  badgeOnline: { backgroundColor: brand.primarySoft },
  badgeOffline: { backgroundColor: brand.border },
  bars: { alignItems: 'flex-end', flexDirection: 'row', gap: 3, height: 15 },
  bar: { borderRadius: 1, width: 3 },
  barOnline: { backgroundColor: brand.primary },
  barOffline: { backgroundColor: brand.fgMuted },
  slash: {
    backgroundColor: brand.fgMuted,
    borderRadius: 1,
    height: 2,
    position: 'absolute',
    transform: [{ rotate: '-45deg' }],
    width: 26,
  },
});
