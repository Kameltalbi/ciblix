import { describe, expect, it } from 'vitest';
import { chunkText } from './ingestionService.js';

describe('chunkText', () => {
  it('returns empty for tiny content', () => {
    expect(chunkText('court')).toEqual([]);
  });

  it('splits long text into overlapping chunks', () => {
    const text = Array.from({ length: 80 }, (_, i) => `Paragraphe numéro ${i} avec du contenu commercial utile.`).join('\n\n');
    const chunks = chunkText(text, 'Brochure');
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.title).toBe('Brochure');
    expect(chunks.every((c) => c.content.length > 40)).toBe(true);
  });
});
