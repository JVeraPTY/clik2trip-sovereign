/**
 * Clik2Trip brand tokens, transcribed from the pre-existing web application's
 * `apps/web/src/app/globals.css`. The web app remains the source of truth: when
 * a token changes there, change it here rather than inventing a new value.
 *
 * The brand's typeface is Plus Jakarta Sans. The web app self-hosts it as
 * `woff2`, which React Native cannot load, so this screen uses the platform
 * sans stack until a `ttf` of the same family is added.
 */
export const brand = {
  primary: '#FF6A00',
  primaryPressed: '#E05A00',
  /** Passes AA on white, so it is the one used for text, never `primary`. */
  primaryText: '#B84A00',
  primarySoft: '#FFF2E8',
  primarySofter: '#FFE2CC',

  secondary: '#1E3A5F',
  secondaryDeep: '#16293F',
  secondarySoft: '#EAEFF5',

  success: '#1B7A4D',
  successSoft: '#E7F5EE',
  warning: '#8A6314',
  warningSoft: '#FDF3DC',
  danger: '#B3261E',
  dangerSoft: '#FDECEA',

  bg: '#FFFFFF',
  surface: '#FBF9F7',
  fg: '#211A14',
  fgMuted: '#6B625A',
  border: '#E7E0D8',
  borderStrong: '#D8CEC2',

  onPrimary: '#FFFFFF',
  disabledBg: '#E7E0D8',
  disabledFg: '#6B625A',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
} as const;

export const text = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
} as const;
