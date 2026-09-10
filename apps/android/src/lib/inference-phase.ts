export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * VisionPsy spends roughly 90 seconds before its first token and then streams,
 * so a single spinner reads as a hang. Naming the phase, and showing that
 * characters are arriving, is what tells the traveler the device is working.
 */
export function analysisPhaseLabel(streamedCharacters: number): string {
  if (streamedCharacters === 0) return 'Interpretando la imagen en el dispositivo';
  return `Redactando la lectura · ${streamedCharacters} caracteres`;
}
