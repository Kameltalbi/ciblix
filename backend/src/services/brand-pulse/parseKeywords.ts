/** Découpe une liste ou une chaîne de mots-clés (virgules, retours ligne, point-virgule). */
export function parseBrandKeywords(input: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(input) ? input.join('\n') : (input ?? '');
  const parts = raw
    .split(/[,;\n|]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  return [...new Set(parts)];
}
