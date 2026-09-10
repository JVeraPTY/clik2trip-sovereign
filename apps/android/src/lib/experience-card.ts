import type { CatalogExperience } from '@clik2trip/cliktotrip-client';
import type { LocalTour } from '@clik2trip/contracts';

/**
 * What one card needs to draw. The connected catalogue fills every field; a
 * local recommendation fills only what the offline snapshot carries, which by
 * design excludes price and capacity.
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
  };
}

/**
 * A recommendation card. The recommendation itself is produced on the device
 * from the offline snapshot; when the connected catalogue is already in memory
 * the matching entry lends its picture, price and provider. Nothing is fetched
 * to build this, so an offline run still renders — just without those extras.
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
    providerName: match?.providerName ?? null,
    priceFrom: match?.priceFrom ?? null,
    currency: match?.currency ?? null,
    confirmationType: match?.confirmationType ?? null,
    thumbnailUrl: match?.thumbnailUrl ?? null,
  };
}
