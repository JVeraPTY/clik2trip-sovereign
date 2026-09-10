import { StyleSheet, Text, View } from 'react-native';

import { toReadableError } from '../lib/error-messages';
import { brand, radius, space, text } from '../theme/brand';

/**
 * Shows a refusal as a sentence, with its technical identifier kept visible and
 * selectable underneath. The identifier is what the evaluation reports and bug
 * reports quote, so it is never replaced by the sentence.
 */
export function ErrorNotice({ code }: { code: string }) {
  const readable = toReadableError(code);
  return (
    <View accessibilityRole="alert" style={styles.card}>
      <Text style={styles.message}>{readable.message}</Text>
      <Text selectable style={styles.code}>
        {readable.code}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: brand.dangerSoft,
    borderRadius: radius.md,
    gap: space[2],
    padding: space[4],
  },
  message: { color: brand.danger, fontSize: text.base, fontWeight: '600', lineHeight: 22 },
  code: { color: brand.fgMuted, fontSize: text.xs, lineHeight: 16 },
});
