import { Pressable, StyleSheet, Text, View } from 'react-native';

import { toReadableError } from '../lib/error-messages';
import {
  canDismissOnboarding,
  onboardingProgress,
  type OnboardingStep,
} from '../lib/onboarding';
import { brand, radius, space, text } from '../theme/brand';
import { ProgressBar } from './ProgressBar';

/**
 * Fixed footer that walks the three preparations the app needs before it can do
 * anything: the vision model, the local catalogue and the testnet wallet. It
 * reports which one is running, its download percentage, and how many are done.
 */
export function OnboardingFooter({
  errorCode,
  onDismiss,
  onRetry,
  steps,
}: {
  errorCode: string | null;
  onDismiss: () => void;
  onRetry: () => void;
  steps: readonly OnboardingStep[];
}) {
  const progress = onboardingProgress(steps);
  const percent = progress.current?.percent;

  return (
    <View style={styles.footer}>
      <View style={styles.row}>
        <Text style={styles.title}>
          {progress.done
            ? 'Todo listo'
            : progress.failed
              ? 'No se pudo preparar'
              : 'Preparando la experiencia'}
        </Text>
        <View style={[styles.counter, progress.done && styles.counterDone]}>
          <Text style={[styles.counterText, progress.done && styles.counterTextDone]}>
            {progress.completed}/{progress.total}
          </Text>
        </View>
      </View>

      {progress.done ? (
        <Text style={styles.detail}>
          Visión, catálogo y wallet de prueba están listos en este dispositivo.
        </Text>
      ) : progress.failed && errorCode ? (
        <Text style={styles.detail}>{toReadableError(errorCode).message}</Text>
      ) : (
        <>
          <Text style={styles.detail}>{progress.current?.label ?? ''}</Text>
          {progress.current ? (
            <Text style={styles.technical}>{progress.current.technical}</Text>
          ) : null}
        </>
      )}

      {!progress.done && !progress.failed && typeof percent === 'number' && percent > 0 ? (
        <ProgressBar percent={percent} />
      ) : null}

      {canDismissOnboarding(steps) ? (
        <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.action}>
          <Text style={styles.actionText}>Empezar</Text>
        </Pressable>
      ) : progress.failed ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.action}>
          <Text style={styles.actionText}>Reintentar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: brand.bg,
    borderTopColor: brand.border,
    borderTopWidth: 1,
    gap: space[2],
    paddingBottom: space[5],
    paddingHorizontal: space[5],
    paddingTop: space[4],
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
  title: { color: brand.fg, flex: 1, fontSize: text.base, fontWeight: '700' },
  counter: {
    backgroundColor: brand.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: space[3],
    paddingVertical: space[1] + 2,
  },
  counterDone: { backgroundColor: brand.successSoft },
  counterText: {
    color: brand.primaryText,
    fontSize: text.sm,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  counterTextDone: { color: brand.success },
  detail: { color: brand.fgMuted, fontSize: text.sm, lineHeight: 20 },
  technical: {
    color: brand.primaryText,
    fontFamily: 'monospace',
    fontSize: text.xs,
    lineHeight: 18,
  },
  action: {
    alignItems: 'center',
    backgroundColor: brand.primary,
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 44,
  },
  actionText: { color: brand.onPrimary, fontSize: text.sm, fontWeight: '700' },
});
