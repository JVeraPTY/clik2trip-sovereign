import { Image, StatusBar, StyleSheet, Text, View } from 'react-native';

import { useConnectivity } from '../lib/use-connectivity';
import { brand, radius, space, text } from '../theme/brand';
import { CameraButton } from './CameraButton';
import { ConnectivityIcon } from './ConnectivityIcon';

/**
 * Mirrors the Clik2Trip web header: the brand mark and wordmark on the left,
 * an action on the right. Where the site puts search, this app puts live
 * connectivity, because whether the device is online is the thing that changes
 * what this screen can do — and being offline here is the point, not a fault.
 */
export function AppHeader({
  cameraDisabled = false,
  onCapture,
}: {
  cameraDisabled?: boolean;
  onCapture: () => void;
}) {
  const status = useConnectivity();

  return (
    <View style={styles.header}>
      <Image
        accessibilityLabel="Clik2Trip"
        source={require('../../assets/clik2trip-mark.png')}
        style={styles.mark}
      />
      <Text style={styles.wordmark}>
        cli<Text style={styles.wordmarkAccent}>K</Text>totrip
      </Text>
      <View style={styles.spacer} />
      <CameraButton disabled={cameraDisabled} onPress={onCapture} />
      <ConnectivityIcon status={status} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: brand.bg,
    borderBottomColor: brand.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: space[2],
    paddingBottom: space[3],
    paddingHorizontal: space[5],
    // Expo's status bar is translucent, and Android's SafeAreaView does not
    // inset it, so without this the clock sits on top of the wordmark.
    paddingTop: (StatusBar.currentHeight ?? 0) + space[3],
  },
  mark: { borderRadius: radius.sm, height: 34, width: 34 },
  wordmark: { color: brand.fg, fontSize: text.xl, fontWeight: '700', letterSpacing: -0.4 },
  wordmarkAccent: { color: brand.primary, fontWeight: '800' },
  spacer: { flex: 1 },
});
