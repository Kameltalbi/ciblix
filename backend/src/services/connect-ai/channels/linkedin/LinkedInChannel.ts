import type { IChannel, ChannelPageContext } from '../IChannel.js';
import type { ProspectProfile } from '../../core/types.js';

function pickString(raw: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function pickNumber(raw: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = parseInt(v.replace(/\D/g, ''), 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

/** Canal LinkedIn — logique spécifique isolée ici, jamais dans le core. */
export class LinkedInChannel implements IChannel {
  readonly slug = 'LINKEDIN' as const;
  readonly name = 'LinkedIn';

  detect(ctx: ChannelPageContext): boolean {
    return (
      ctx.hostname.includes('linkedin.com') &&
      (ctx.pathname.startsWith('/in/') ||
        ctx.pathname.includes('/messaging/') ||
        ctx.pathname.includes('/sales/'))
    );
  }

  normalizeProfile(raw: Record<string, unknown>): ProspectProfile {
    const firstName = pickString(raw, 'firstName', 'first_name', 'prenom');
    const lastName = pickString(raw, 'lastName', 'last_name', 'nom');
    const fullName =
      pickString(raw, 'fullName', 'full_name', 'name') ||
      [firstName, lastName].filter(Boolean).join(' ') ||
      undefined;

    return {
      firstName,
      lastName,
      fullName,
      company: pickString(raw, 'company', 'entreprise', 'companyName'),
      jobTitle: pickString(raw, 'jobTitle', 'job_title', 'fonction', 'headline'),
      country: pickString(raw, 'country', 'pays', 'location'),
      sector: pickString(raw, 'sector', 'secteur', 'industry'),
      profileUrl: pickString(raw, 'profileUrl', 'profile_url', 'url'),
      headline: pickString(raw, 'headline'),
      description: pickString(raw, 'description', 'about', 'summary'),
      connectionCount: pickNumber(raw, 'connectionCount', 'connections', 'nombre_relations'),
      experience: Array.isArray(raw.experience) ? raw.experience : undefined,
      education: Array.isArray(raw.education) ? raw.education : undefined,
      raw,
    };
  }

  displayHints() {
    return {
      composeSelector:
        '.msg-form__contenteditable, div[role="textbox"][contenteditable="true"], .compose-form__message-field',
      profileIndicator: '.pv-text-details__left-panel, main[aria-label*="profile"]',
    };
  }
}
