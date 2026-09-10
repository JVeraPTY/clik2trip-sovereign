import { Pressable, StyleSheet, View } from 'react-native';

import { brand, radius } from '../theme/brand';

/**
 * Camera glyph drawn with plain views, for the same reason as the connectivity
 * icon: no SVG renderer in this project and no asset worth shipping for it.
 */
export function CameraButton({
  disabled = false,
  onPress,
}: {
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel="Tomar foto"
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.badge,
        disabled && styles.badgeDisabled,
        pressed && styles.badgePressed,
      ]}
    >
      <View style={[styles.bump, disabled && styles.inkDisabled]} />
      <View style={[styles.body, disabled && styles.inkDisabled]}>
        <View style={[styles.lens, disabled && styles.lensDisabled]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: brand.primarySoft,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  badgeDisabled: { backgroundColor: brand.border },
  badgePressed: { backgroundColor: brand.primarySofter },
  bump: {
    backgroundColor: brand.primary,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    height: 3,
    marginBottom: -1,
    width: 9,
  },
  body: {
    alignItems: 'center',
    backgroundColor: brand.primary,
    borderRadius: 4,
    height: 15,
    justifyContent: 'center',
    width: 21,
  },
  lens: {
    backgroundColor: brand.primarySoft,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  inkDisabled: { backgroundColor: brand.fgMuted },
  lensDisabled: { backgroundColor: brand.border },
});
