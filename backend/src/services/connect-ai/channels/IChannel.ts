import type { ConnectChannelSlug, ProspectProfile } from '../core/types.js';

/** Contexte page pour détection canal (extension content script). */
export interface ChannelPageContext {
  url: string;
  hostname: string;
  pathname: string;
}

/** Interface plugin — chaque canal (LinkedIn, Gmail, …) l'implémente. */
export interface IChannel {
  readonly slug: ConnectChannelSlug;
  readonly name: string;

  /** Détecte si la page courante appartient à ce canal. */
  detect(ctx: ChannelPageContext): boolean;

  /** Valide et normalise un profil extrait côté extension. */
  normalizeProfile(raw: Record<string, unknown>): ProspectProfile;

  /** Métadonnées UI pour le side panel (canal-agnostique côté core). */
  displayHints(): {
    composeSelector?: string;
    profileIndicator?: string;
  };
}
