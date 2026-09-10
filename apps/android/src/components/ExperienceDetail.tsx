import {
  Clik2TripGraphQlClient,
  type AvailabilitySlot,
  type BookingHold,
  type LiveTour,
} from '@clik2trip/cliktotrip-client';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  availableDates,
  formatDateLabel,
  formatTotal,
  slotsForDate,
} from '../lib/availability-view';
import { confirmationLabel, experienceFootnote } from '../lib/catalog-format';
import { buildAvailabilityWindow, eligibleAvailability, remainingHoldSeconds } from '../lib/commerce';
import type { ExperienceCardData } from '../lib/experience-card';
import { brand, radius, space, text } from '../theme/brand';
import { ErrorNotice } from './ErrorNotice';
import { SandboxSettlement } from './SandboxSettlement';

const defaultGateway = 'https://www.clik2trip.com/graphql';

type DetailState = 'LOADING' | 'SELECTING' | 'CUSTOMER' | 'CREATING_HOLD' | 'HOLD_ACTIVE' | 'HOLD_EXPIRED' | 'ERROR';

function errorCode(cause: unknown): string {
  if (cause && typeof cause === 'object' && 'code' in cause) return String(cause.code);
  if (cause && typeof cause === 'object' && 'issues' in cause) return 'DATOS_CLIENTE_INVALIDOS';
  return cause instanceof Error ? cause.message : 'CLIK2TRIP_REQUEST_FAILED';
}

function Chip({
  disabled = false,
  label,
  note,
  onPress,
  selected,
}: {
  disabled?: boolean;
  label: string;
  note?: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
      {note ? (
        <Text style={[styles.chipNote, selected && styles.chipNoteSelected]}>{note}</Text>
      ) : null}
    </Pressable>
  );
}

function PrimaryButton({
  disabled = false,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        disabled && styles.primaryDisabled,
        pressed && styles.primaryPressed,
      ]}
    >
      <Text style={[styles.primaryText, disabled && styles.primaryTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

export function ExperienceDetail({
  card,
  onBack,
  slug,
}: {
  card: ExperienceCardData;
  onBack: () => void;
  slug: string;
}) {
  const client = useMemo(
    () =>
      new Clik2TripGraphQlClient({
        endpoint: process.env.EXPO_PUBLIC_CLIKTOTRIP_GATEWAY ?? defaultGateway,
      }),
    [],
  );
  const [state, setState] = useState<DetailState>('LOADING');
  const [liveTour, setLiveTour] = useState<LiveTour | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [participants, setParticipants] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hold, setHold] = useState<BookingHold | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  const dates = availableDates(slots);
  const timesForDate = selectedDate ? slotsForDate(slots, selectedDate) : [];
  const secondsLeft = remainingHoldSeconds(hold?.holdExpiresAt ?? null, now);
  const maxParticipants = Math.min(20, selectedSlot?.spotsLeft ?? 1);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const currentTour = await client.getTour({ slug, locale: 'es' });
        if (!currentTour || currentTour.tourRefId !== card.tourRefId) {
          throw new Error('CATALOGO_LOCAL_DESACTUALIZADO');
        }
        const window = buildAvailabilityWindow(new Date());
        const availability = await client.getAvailability({
          tourRefId: currentTour.tourRefId,
          ...window,
        });
        const eligible = eligibleAvailability(availability, 1);
        if (eligible.length === 0) throw new Error('SIN_DISPONIBILIDAD');
        if (!active) return;
        setLiveTour(currentTour);
        setSlots(eligible);
        const firstDate = eligible[0]?.date ?? null;
        setSelectedDate(firstDate);
        setSelectedSlot(eligible[0] ?? null);
        setState('SELECTING');
      } catch (cause) {
        if (!active) return;
        setError(errorCode(cause));
        setState('ERROR');
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [card.tourRefId, client, slug]);

  useEffect(() => {
    if (!hold?.holdExpiresAt) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (Date.parse(hold.holdExpiresAt ?? '') <= current) {
        setState('HOLD_EXPIRED');
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [hold]);

  function chooseDate(date: string) {
    setSelectedDate(date);
    const first = slotsForDate(slots, date)[0] ?? null;
    setSelectedSlot(first);
    setParticipants(1);
  }

  async function createHold() {
    if (!liveTour || !selectedSlot) return;
    setError(null);
    setState('CREATING_HOLD');
    try {
      // Price and capacity are re-read immediately before the mutation. The
      // list the traveler chose from may be seconds old.
      const currentTour = await client.getTour({ slug, locale: 'es' });
      if (!currentTour || currentTour.tourRefId !== liveTour.tourRefId) {
        throw new Error('CATALOGO_LOCAL_DESACTUALIZADO');
      }
      const currentSlots = await client.getAvailability({
        tourRefId: currentTour.tourRefId,
        from: selectedSlot.date,
        to: selectedSlot.date,
      });
      const currentSlot = currentSlots.find(
        (slot) => slot.timeSlot === selectedSlot.timeSlot && !slot.isBlocked,
      );
      if (!currentSlot || currentSlot.spotsLeft < participants) {
        throw new Error('SIN_DISPONIBILIDAD');
      }
      const created = await client.createBookingHold({
        tourRefId: currentTour.tourRefId,
        date: currentSlot.date,
        timeSlot: currentSlot.timeSlot,
        participants,
        customer: {
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          // The gateway takes an optional phone but rejects a short one, so a
          // partially typed number is omitted rather than sent and refused.
          ...(phone.trim().length >= 7 ? { phone: phone.trim() } : {}),
        },
      });
      if (!created.holdExpiresAt) throw new Error('HOLD_EXPIRY_MISSING');
      setLiveTour(currentTour);
      setSelectedSlot(currentSlot);
      setHold(created);
      setNow(Date.now());
      setState('HOLD_ACTIVE');
    } catch (cause) {
      setError(errorCode(cause));
      setState('CUSTOMER');
    }
  }

  const price = liveTour?.priceFrom ?? card.priceFrom ?? 0;
  const currency = liveTour?.currency ?? card.currency ?? 'USD';
  const customerReady =
    fullName.trim().length > 1 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹ Volver</Text>
      </Pressable>

      {card.thumbnailUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: card.thumbnailUrl }}
          style={styles.hero}
        />
      ) : null}

      <Text style={styles.title}>{card.title}</Text>
      {card.destinationName ? (
        <Text style={styles.destination}>{card.destinationName}</Text>
      ) : null}
      {card.summary ? <Text style={styles.summary}>{card.summary}</Text> : null}
      {card.providerName ? (
        <Text style={styles.footnote}>
          {experienceFootnote(card.durationMin, card.providerName)}
        </Text>
      ) : null}

      {state === 'LOADING' ? (
        <Text style={styles.meta}>Consultando precio y disponibilidad…</Text>
      ) : null}

      {state === 'SELECTING' || state === 'CUSTOMER' || state === 'CREATING_HOLD' ? (
        <View style={styles.panel}>
          <Text style={styles.price}>
            Desde {currency} {price.toFixed(2)}
          </Text>
          {card.confirmationType ? (
            <View
              style={[
                styles.badge,
                card.confirmationType === 'INMEDIATA'
                  ? styles.badgeImmediate
                  : styles.badgePending,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  card.confirmationType === 'INMEDIATA'
                    ? styles.badgeTextImmediate
                    : styles.badgeTextPending,
                ]}
              >
                {confirmationLabel(card.confirmationType)}
              </Text>
            </View>
          ) : null}

          {state === 'SELECTING' ? (
            <>
              <Text style={styles.label}>Fecha</Text>
              <View style={styles.chipRow}>
                {dates.map((date) => (
                  <Chip
                    key={date}
                    label={formatDateLabel(date)}
                    onPress={() => chooseDate(date)}
                    selected={date === selectedDate}
                  />
                ))}
              </View>

              <Text style={styles.label}>Hora</Text>
              <View style={styles.chipRow}>
                {timesForDate.map((slot) => (
                  <Chip
                    key={`${slot.date}-${slot.timeSlot}`}
                    label={slot.timeSlot}
                    note={`${slot.spotsLeft} libres`}
                    onPress={() => {
                      setSelectedSlot(slot);
                      setParticipants(1);
                    }}
                    selected={
                      selectedSlot?.date === slot.date && selectedSlot.timeSlot === slot.timeSlot
                    }
                  />
                ))}
              </View>

              <Text style={styles.label}>Participantes</Text>
              <View style={styles.stepper}>
                <Pressable
                  accessibilityLabel="Quitar un participante"
                  accessibilityRole="button"
                  disabled={participants <= 1}
                  onPress={() => setParticipants((current) => Math.max(1, current - 1))}
                  style={[styles.stepperButton, participants <= 1 && styles.stepperDisabled]}
                >
                  <Text style={styles.stepperSign}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{participants}</Text>
                <Pressable
                  accessibilityLabel="Añadir un participante"
                  accessibilityRole="button"
                  disabled={participants >= maxParticipants}
                  onPress={() =>
                    setParticipants((current) => Math.min(maxParticipants, current + 1))
                  }
                  style={[
                    styles.stepperButton,
                    participants >= maxParticipants && styles.stepperDisabled,
                  ]}
                >
                  <Text style={styles.stepperSign}>+</Text>
                </Pressable>
              </View>

              <Text style={styles.total}>Total {formatTotal(price, participants, currency)}</Text>
              <PrimaryButton
                disabled={!selectedSlot}
                label="Reservar"
                onPress={() => setState('CUSTOMER')}
              />
            </>
          ) : null}

          {state === 'CUSTOMER' || state === 'CREATING_HOLD' ? (
            <>
              <Text style={styles.sectionTitle}>Completa tu reserva</Text>
              <Text style={styles.label}>Fecha</Text>
              <Text style={styles.value}>
                {selectedSlot?.date} · {selectedSlot?.timeSlot}
              </Text>
              <Text style={styles.label}>Participantes</Text>
              <Text style={styles.value}>{participants}</Text>

              <Text style={styles.label}>Nombre completo</Text>
              <TextInput
                accessibilityLabel="Nombre completo"
                autoCapitalize="words"
                onChangeText={setFullName}
                style={styles.input}
                value={fullName}
              />
              <Text style={styles.label}>Correo</Text>
              <TextInput
                accessibilityLabel="Correo"
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
                style={styles.input}
                value={email}
              />
              <Text style={styles.label}>Teléfono (opcional)</Text>
              <TextInput
                accessibilityLabel="Teléfono"
                keyboardType="phone-pad"
                onChangeText={setPhone}
                style={styles.input}
                value={phone}
              />
              <PrimaryButton
                disabled={state === 'CREATING_HOLD' || !customerReady}
                label={state === 'CREATING_HOLD' ? 'Creando reserva…' : 'Continuar al pago'}
                onPress={() => void createHold()}
              />
              <Text style={styles.meta}>
                Tienes 15 minutos para completar el pago. Pasado ese tiempo, el lugar vuelve a
                quedar disponible.
              </Text>
            </>
          ) : null}
        </View>
      ) : null}

      {hold ? (
        <View style={styles.hold}>
          <Text style={styles.holdTitle}>Reserva {hold.code}</Text>
          <Text style={styles.value}>
            Total congelado: {hold.priceSnapshot.currency} {hold.priceSnapshot.total}
          </Text>
          <Text style={styles.countdown}>
            {state === 'HOLD_EXPIRED'
              ? 'RESERVA EXPIRADA'
              : `Expira en ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`}
          </Text>
          <Text style={styles.warning}>Aún no se inició ni autorizó ningún pago.</Text>
        </View>
      ) : null}

      {error ? <ErrorNotice code={error} /> : null}
      {hold ? <SandboxSettlement client={client} hold={hold} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: brand.surface, flex: 1 },
  content: { gap: space[3], padding: space[5] },
  back: { paddingVertical: space[1] },
  backText: { color: brand.primaryText, fontSize: text.base, fontWeight: '700' },
  hero: {
    aspectRatio: 16 / 10,
    backgroundColor: brand.border,
    borderRadius: radius.lg,
    width: '100%',
  },
  title: { color: brand.fg, fontSize: text['2xl'], fontWeight: '800', lineHeight: 34 },
  destination: { color: brand.fgMuted, fontSize: text.base },
  summary: { color: brand.fg, fontSize: text.sm, lineHeight: 21 },
  footnote: { color: brand.fgMuted, fontSize: text.xs },
  meta: { color: brand.fgMuted, fontSize: text.sm, lineHeight: 20 },
  panel: {
    backgroundColor: brand.bg,
    borderColor: brand.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: space[3],
    padding: space[5],
  },
  price: { color: brand.fg, fontSize: text['2xl'], fontWeight: '800' },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  badgeImmediate: { backgroundColor: brand.successSoft },
  badgePending: { backgroundColor: brand.primarySofter },
  badgeText: { fontSize: text.xs, fontWeight: '700' },
  badgeTextImmediate: { color: brand.success },
  badgeTextPending: { color: brand.primaryText },
  label: { color: brand.fgMuted, fontSize: text.sm },
  value: { color: brand.fg, fontSize: text.base, fontWeight: '600' },
  sectionTitle: { color: brand.fg, fontSize: text.xl, fontWeight: '800', marginTop: space[2] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    alignItems: 'center',
    borderColor: brand.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  chipSelected: { backgroundColor: brand.secondary, borderColor: brand.secondary },
  chipDisabled: { borderColor: brand.border, opacity: 0.5 },
  chipLabel: { color: brand.fg, fontSize: text.sm, fontWeight: '700' },
  chipLabelSelected: { color: brand.onPrimary },
  chipNote: { color: brand.fgMuted, fontSize: text.xs },
  chipNoteSelected: { color: brand.secondarySoft },
  stepper: { alignItems: 'center', flexDirection: 'row', gap: space[4] },
  stepperButton: {
    alignItems: 'center',
    borderColor: brand.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  stepperDisabled: { opacity: 0.4 },
  stepperSign: { color: brand.fg, fontSize: text.xl, fontWeight: '700' },
  stepperValue: { color: brand.fg, fontSize: text.xl, fontWeight: '800', minWidth: 32, textAlign: 'center' },
  total: { color: brand.fg, fontSize: text.xl, fontWeight: '800' },
  input: {
    borderColor: brand.borderStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: brand.fg,
    fontSize: text.base,
    minHeight: 48,
    paddingHorizontal: space[3],
  },
  primary: {
    alignItems: 'center',
    backgroundColor: brand.primary,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryDisabled: { backgroundColor: brand.disabledBg },
  primaryPressed: { backgroundColor: brand.primaryPressed },
  primaryText: { color: brand.onPrimary, fontSize: text.base, fontWeight: '800' },
  primaryTextDisabled: { color: brand.disabledFg },
  hold: {
    backgroundColor: brand.successSoft,
    borderRadius: radius.lg,
    gap: space[2],
    padding: space[4],
  },
  holdTitle: { color: brand.fg, fontSize: text.lg, fontWeight: '800' },
  countdown: { color: brand.success, fontSize: text.lg, fontWeight: '800' },
  warning: {
    backgroundColor: brand.warningSoft,
    borderRadius: radius.sm,
    color: brand.warning,
    fontSize: text.sm,
    lineHeight: 20,
    padding: space[3],
  },
});
