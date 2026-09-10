import { z } from 'zod';

import {
  localTourSchema,
  visionAnalysisSchema,
  type LocalTour,
  type VisionAnalysis,
} from '@clik2trip/contracts';

export const catalogSnapshotVersion = 'approved-seed-es-2026-09-09-v1';

export const extractionPrompt = `Classify this tourism image. Fill every field from visible evidence only. Use short English values. For unknown destination use "", for unknown duration use 0. Do not infer price, availability, booking, identity, or safety.`;

export const visionPsyPrompt = {
  id: 'tourism-image-extraction-v3',
  sha256: '21ddd3b048fe0a927016da17107ebe42d72d7710e7ff82231e8fb83d1ee94ec4',
} as const;

export const visionAnalysisJsonSchema = {
  type: 'object',
  properties: {
    c: { type: 'string' },
    d: { type: 'string' },
    m: { type: 'integer', minimum: 0 },
    a: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    r: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    p: { type: 'number', minimum: 0, maximum: 1 },
    e: { type: 'array', items: { type: 'string' }, maxItems: 3 },
  },
  required: ['c', 'd', 'm', 'a', 'r', 'p', 'e'],
  additionalProperties: false,
} satisfies Record<string, unknown>;

const compactVisionAnalysisSchema = z.object({
  c: z.string().min(1),
  d: z.string().nullable(),
  m: z.number().int().nonnegative().nullable(),
  a: z.array(z.string()),
  r: z.array(z.string()),
  p: z.number().min(0).max(1),
  e: z.array(z.string()),
});

export const localTourCatalog: LocalTour[] = localTourSchema.array().parse([
  {
    tourRefId: 'tour-rafting-pacuare',
    slug: 'rafting-rio-pacuare',
    title: 'Rafting en el Río Pacuare',
    summary: 'Clase III-IV por el Río Pacuare entre selva primaria.',
    destinationName: 'Limón',
    categoryName: 'Aventura',
    durationMin: 480,
    includes: ['Transporte desde San José', 'Guías certificados', 'Equipo de seguridad', 'Almuerzo'],
    excludes: ['Propinas', 'Fotos profesionales'],
    searchTerms: ['rafting', 'whitewater', 'river', 'rapids', 'adventure', 'selva', 'río', 'aventura'],
  },
  {
    tourRefId: 'tour-surf-tamarindo',
    slug: 'clase-surf-tamarindo',
    title: 'Clase de surf en Tamarindo',
    summary: 'Dos horas con instructor certificado para principiantes e intermedios.',
    destinationName: 'Guanacaste',
    categoryName: 'Playa y mar',
    durationMin: 120,
    includes: ['Tabla de surf', 'Licra', 'Instructor certificado'],
    excludes: ['Transporte', 'Bloqueador solar'],
    searchTerms: ['surf', 'beach', 'ocean', 'waves', 'beginner', 'playa', 'mar', 'olas'],
  },
  {
    tourRefId: 'tour-volcan-arenal',
    slug: 'caminata-volcan-arenal',
    title: 'Caminata al Volcán Arenal',
    summary: 'Sendero de lava de 1968 con vistas al cono y al Lago Arenal.',
    destinationName: 'La Fortuna',
    categoryName: 'Naturaleza',
    durationMin: 240,
    includes: ['Entrada al parque nacional', 'Guía naturalista', 'Agua'],
    excludes: ['Transporte', 'Almuerzo'],
    searchTerms: ['hiking', 'trail', 'volcano', 'nature', 'forest', 'senderismo', 'caminata', 'volcán'],
  },
  {
    tourRefId: 'tour-termales-privados',
    slug: 'termales-privados-arenal',
    title: 'Termales privados con cena',
    summary: 'Aguas termales de origen volcánico en un circuito privado, con cena incluida.',
    destinationName: 'La Fortuna',
    categoryName: 'Bienestar',
    durationMin: 300,
    includes: ['Acceso a termales', 'Cena de tres tiempos', 'Toalla y casillero'],
    excludes: ['Bebidas alcohólicas', 'Transporte'],
    searchTerms: ['hot springs', 'wellness', 'relaxation', 'volcanic', 'termales', 'bienestar', 'cena'],
  },
]);

export const localTourDocuments = localTourCatalog.map((tour) => JSON.stringify(tour));

function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function parseVisionAnalysis(text: string): VisionAnalysis | null {
  const candidate = extractJsonObject(text);
  if (!candidate) return null;

  const full = visionAnalysisSchema.safeParse(candidate);
  if (full.success) return full.data;

  const compact = compactVisionAnalysisSchema.safeParse(candidate);
  if (!compact.success) return null;

  return visionAnalysisSchema.parse({
    category: compact.data.c,
    destination: compact.data.d || null,
    durationMinutes: compact.data.m || null,
    accessibilitySignals: compact.data.a,
    restrictions: compact.data.r,
    confidence: compact.data.p,
    evidence: compact.data.e,
  });
}

export function buildTourismQuery(analysis: VisionAnalysis | null, rawText: string): string {
  if (!analysis) return rawText.slice(0, 700);
  return [
    analysis.category,
    analysis.destination,
    ...analysis.accessibilitySignals,
    ...analysis.restrictions,
    ...analysis.evidence,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .slice(0, 700);
}

export function parseTourDocument(content: string): LocalTour {
  return localTourSchema.parse(JSON.parse(content));
}
