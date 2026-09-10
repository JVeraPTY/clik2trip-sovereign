import type { CatalogExperience } from '@clik2trip/cliktotrip-client';
import type { LocalTour } from '@clik2trip/contracts';
import { describe, expect, it } from 'vitest';

import { catalogCard, recommendationCard } from './experience-card';

const catalogEntry: CatalogExperience = {
  tourRefId: 'tour-volcan-arenal',
  slug: 'caminata-volcan-arenal',
  title: 'Caminata al Volcán Arenal',
  summary: 'Sendero de lava de 1968.',
  destinationName: 'La Fortuna',
  providerName: 'Arenal Expediciones',
  confirmationType: 'INMEDIATA',
  durationMin: 240,
  priceFrom: 95,
  currency: 'USD',
  thumbnailUrl: 'https://example.com/arenal.jpg',
  hasAvailabilityNext30Days: true,
};

const localTour: LocalTour = {
  tourRefId: 'tour-volcan-arenal',
  slug: 'caminata-volcan-arenal',
  title: 'Caminata al Volcán Arenal',
  summary: 'Sendero de lava con vistas al cono.',
  destinationName: 'La Fortuna',
  categoryName: 'Aventura',
  durationMin: 240,
  includes: [],
  excludes: [],
  searchTerms: [],
  source: 'clik2trip',
};

const demoTour: LocalTour = {
  tourRefId: 'demo-isla-otoque-dia-completo',
  slug: 'isla-otoque-dia-completo',
  title: 'Isla Otoque día completo con almuerzo local',
  summary: 'Travesía por el golfo hasta una isla de pescadores.',
  destinationName: 'Isla Otoque',
  categoryName: 'Islas',
  durationMin: 540,
  includes: [],
  excludes: [],
  searchTerms: [],
  source: 'demo-seed',
  regionId: 'panama-city',
  geo: { lat: 8.6333, lng: -79.6167 },
  priceFrom: 95,
  currency: 'USD',
  providerName: 'Operador demo Pacífico',
};

describe('experience cards', () => {
  it('carries every field a connected catalogue entry has', () => {
    expect(catalogCard(catalogEntry)).toMatchObject({
      tourRefId: 'tour-volcan-arenal',
      priceFrom: 95,
      providerName: 'Arenal Expediciones',
      thumbnailUrl: 'https://example.com/arenal.jpg',
    });
  });

  it('borrows picture, price and provider from the catalogue entry it matches', () => {
    const card = recommendationCard(localTour, [catalogEntry]);

    expect(card.thumbnailUrl).toBe('https://example.com/arenal.jpg');
    expect(card.priceFrom).toBe(95);
    expect(card.providerName).toBe('Arenal Expediciones');
    // The recommendation's own wording wins: it is what the device produced.
    expect(card.summary).toBe('Sendero de lava con vistas al cono.');
  });

  it('still renders when the catalogue never loaded, without price or picture', () => {
    const card = recommendationCard(localTour, []);

    expect(card.title).toBe('Caminata al Volcán Arenal');
    expect(card.destinationName).toBe('La Fortuna');
    expect(card.durationMin).toBe(240);
    expect(card.thumbnailUrl).toBeNull();
    expect(card.priceFrom).toBeNull();
    expect(card.confirmationType).toBeNull();
  });

  it('does not borrow from a different tour', () => {
    const other = { ...catalogEntry, tourRefId: 'tour-rafting-pacuare' };

    expect(recommendationCard(localTour, [other]).thumbnailUrl).toBeNull();
  });

  it('renders a demonstration entry complete with no catalogue at all', () => {
    const card = recommendationCard(demoTour, []);

    expect(card.priceFrom).toBe(95);
    expect(card.currency).toBe('USD');
    expect(card.providerName).toBe('Operador demo Pacífico');
    expect(card.source).toBe('demo-seed');
  });

  it('promises no confirmation for an entry no operator will confirm', () => {
    expect(recommendationCard(demoTour, []).confirmationType).toBeNull();
  });

  it('marks where every card came from', () => {
    expect(catalogCard(catalogEntry).source).toBe('clik2trip');
    expect(recommendationCard(localTour, []).source).toBe('clik2trip');
  });
});
