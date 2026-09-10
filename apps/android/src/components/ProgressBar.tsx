import { StyleSheet, Text, View } from 'react-native';

import { brand, radius, space, text } from '../theme/brand';

export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={styles.wrapper}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped}%` }]} />
      </View>
      <Text style={styles.label}>{clamped}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
  track: {
    backgroundColor: brand.border,
    borderRadius: radius.pill,
    flex: 1,
    height: 8,
    overflow: 'hidden',
  },
  fill: { backgroundColor: brand.primary, height: 8 },
  label: { color: brand.fgMuted, fontSize: text.xs, fontVariant: ['tabular-nums'] },
});
