import type { CatalogExperience } from '@clik2trip/cliktotrip-client';
import type { LocalTour, TourSource } from '@clik2trip/contracts';

/**
 * What one card needs to draw. The connected catalogue fills every field; a
 * local recommendation fills what the offline snapshot carries.
 */
export interface ExperienceCardData {
  tourRefId: string;
  title: string;
  destinationName: string | null;
  summary: string | null;
  durationMin: number | null;
  providerName: string | null;
  priceFrom: number | null;
  currency: string | null;
  confirmationType: 'INMEDIATA' | 'PENDIENTE' | null;
  thumbnailUrl: string | null;
  /** Where the entry came from, so the card can say when it is not bookable. */
  source: TourSource;
}

export function catalogCard(experience: CatalogExperience): ExperienceCardData {
  return {
    tourRefId: experience.tourRefId,
    title: experience.title,
    destinationName: experience.destinationName,
    summary: experience.summary,
    durationMin: experience.durationMin,
    providerName: experience.providerName,
    priceFrom: experience.priceFrom,
    currency: experience.currency,
    confirmationType: experience.confirmationType,
    thumbnailUrl: experience.thumbnailUrl,
    source: 'clik2trip',
  };
}

/**
 * A recommendation card. The recommendation itself is produced on the device
 * from the offline snapshot.
 *
 * For a Clik2Trip entry, price and picture come from the connected catalogue
 * when it happens to be in memory, and are simply absent otherwise — an offline
 * run still renders, just without them, because the Gateway is the only source
 * of a price that may be charged. A demonstration entry carries its own
 * reference price, so it renders complete with no network at all.
 */
export function recommendationCard(
  tour: LocalTour,
  catalog: readonly CatalogExperience[],
): ExperienceCardData {
  const match = catalog.find((experience) => experience.tourRefId === tour.tourRefId);
  return {
    tourRefId: tour.tourRefId,
    title: tour.title,
    destinationName: tour.destinationName,
    summary: tour.summary,
    durationMin: tour.durationMin,
    providerName: match?.providerName ?? tour.providerName ?? null,
    priceFrom: match?.priceFrom ?? tour.priceFrom ?? null,
    currency: match?.currency ?? tour.currency ?? null,
    // No confirmation badge for a demonstration entry. Seeing it on a device
    // made the problem obvious: there is no operator to confirm anything, so
    // promising immediate confirmation is the one claim the card must not make.
    confirmationType: match?.confirmationType ?? null,
    thumbnailUrl: match?.thumbnailUrl ?? null,
    source: tour.source,
  };
}
