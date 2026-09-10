import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  confirmationLabel,
  experienceFootnote,
  formatDuration,
  formatPriceFrom,
} from '../lib/catalog-format';
import type { ExperienceCardData } from '../lib/experience-card';
import { brand, radius, space, text } from '../theme/brand';

export function ExperienceCard({
  card,
  onPress,
}: {
  card: ExperienceCardData;
  onPress?: () => void;
}) {
  const immediate = card.confirmationType === 'INMEDIATA';
  const hasPrice = card.priceFrom !== null && card.currency !== null;
  const footnote = card.providerName
    ? experienceFootnote(card.durationMin, card.providerName)
    : formatDuration(card.durationMin);

  return (
    <Pressable
      accessibilityHint={onPress ? 'Abre el detalle y la reserva' : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && onPress ? styles.cardPressed : null]}
    >
      {card.thumbnailUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: card.thumbnailUrl }}
          style={styles.image}
        />
      ) : null}
      <View style={styles.body}>
        <Text style={styles.title}>{card.title}</Text>
        {card.destinationName ? (
          <Text style={styles.destination}>{card.destinationName}</Text>
        ) : null}
        {card.summary ? <Text style={styles.summary}>{card.summary}</Text> : null}
        {hasPrice || footnote || card.confirmationType ? (
          <>
            <View style={styles.divider} />
            <View style={styles.priceRow}>
              <View style={styles.priceBlock}>
                {hasPrice ? (
                  <Text style={styles.priceLabel}>
                    Desde{' '}
                    <Text style={styles.price}>
                      {formatPriceFrom(card.priceFrom ?? 0, card.currency ?? '')}
                    </Text>
                  </Text>
                ) : (
                  <Text style={styles.priceLabel}>Precio y cupo requieren conexión</Text>
                )}
                {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
              </View>
              {card.confirmationType ? (
                <View
                  style={[styles.badge, immediate ? styles.badgeImmediate : styles.badgePending]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      immediate ? styles.badgeTextImmediate : styles.badgeTextPending,
                    ]}
                  >
                    {confirmationLabel(card.confirmationType)}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ExperienceList({
  cards,
  onSelect,
}: {
  cards: readonly ExperienceCardData[];
  onSelect?: (tourRefId: string) => void;
}) {
  return (
    <View style={styles.list}>
      {cards.map((card) => (
        <ExperienceCard
          card={card}
          key={card.tourRefId}
          onPress={onSelect ? () => onSelect(card.tourRefId) : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[3] },
  card: {
    backgroundColor: brand.bg,
    borderColor: brand.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.9 },
  image: { aspectRatio: 16 / 10, backgroundColor: brand.border, width: '100%' },
  body: { gap: space[2], padding: space[4] },
  title: { color: brand.fg, fontSize: text.lg, fontWeight: '700' },
  destination: { color: brand.fgMuted, fontSize: text.sm },
  summary: { color: brand.fg, fontSize: text.sm, lineHeight: 21 },
  divider: { backgroundColor: brand.border, height: 1, marginVertical: space[1] },
  priceRow: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
  priceBlock: { flex: 1, gap: space[1] },
  priceLabel: { color: brand.fgMuted, fontSize: text.sm },
  price: { color: brand.fg, fontSize: text.lg, fontWeight: '800' },
  footnote: { color: brand.fgMuted, fontSize: text.xs },
  badge: { borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: space[2] },
  badgeImmediate: { backgroundColor: brand.successSoft },
  badgePending: { backgroundColor: brand.primarySofter },
  badgeText: { fontSize: text.xs, fontWeight: '700' },
  badgeTextImmediate: { color: brand.success },
  badgeTextPending: { color: brand.primaryText },
});
