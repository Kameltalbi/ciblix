import { describe, expect, it } from 'vitest';
import { getChannel, resolveChannelFromUrl } from './channelRegistry.js';

describe('channelRegistry', () => {
  it('résout LinkedIn sur profil', () => {
    const ch = resolveChannelFromUrl('https://www.linkedin.com/in/jean-dupont/');
    expect(ch?.slug).toBe('LINKEDIN');
  });

  it('ne résout pas une URL inconnue', () => {
    expect(resolveChannelFromUrl('https://example.com')).toBeUndefined();
  });

  it('getChannel retourne LinkedIn', () => {
    expect(getChannel('LINKEDIN')?.name).toBe('LinkedIn');
  });
});
