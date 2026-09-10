export function formatDuration(durationMin: number | null): string | null {
  if (durationMin === null || durationMin <= 0) return null;
  const hours = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function formatPriceFrom(priceFrom: number, currency: string): string {
  const amount = Number.isInteger(priceFrom) ? String(priceFrom) : priceFrom.toFixed(2);
  return `${currency} ${amount}`;
}

export function confirmationLabel(confirmationType: 'INMEDIATA' | 'PENDIENTE'): string {
  return confirmationType === 'INMEDIATA' ? 'Confirmación inmediata' : 'Sujeto a confirmación';
}

/** The line under the price on the site: duration and who operates the tour. */
export function experienceFootnote(
  durationMin: number | null,
  providerName: string,
): string {
  const duration = formatDuration(durationMin);
  return duration ? `${duration} · ${providerName}` : providerName;
}
