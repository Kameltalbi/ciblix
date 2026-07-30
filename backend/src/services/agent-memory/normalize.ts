/** Normalisation des identifiants contact — utilisée uniquement par contactService. */

export function normalizeEmail(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  return raw.trim().toLowerCase();
}

/** Chiffres nationaux (sans indicatif pays, défaut TN 216). */
export function nationalPhoneDigits(raw: string, defaultCountryCode = '216'): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith(defaultCountryCode)) digits = digits.slice(defaultCountryCode.length);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/**
 * Fixe TN : les numéros nationaux qui commencent par 7 (ex. +21671…) ne sont pas WhatsApp.
 */
export function isFixedLinePhone(raw?: string | null, defaultCountryCode = '216'): boolean {
  if (!raw?.trim()) return false;
  const national = nationalPhoneDigits(raw, defaultCountryCode);
  return national.startsWith('7');
}

export function normalizePhone(raw?: string | null, defaultCountryCode = '216'): string | null {
  if (!raw?.trim()) return null;
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 8 && defaultCountryCode) return `+${defaultCountryCode}${digits}`;
  if (digits.length >= 9) return `+${digits}`;
  return null;
}

export function normalizeWhatsapp(raw?: string | null): string | null {
  if (isFixedLinePhone(raw)) return null;
  return normalizePhone(raw);
}

export function normalizeName(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  return raw.trim().replace(/\s+/g, ' ');
}

export function namesConflict(existing: string | null | undefined, incoming: string | null | undefined): boolean {
  if (!incoming?.trim() || !existing?.trim()) return false;
  return existing.trim().toLowerCase() !== incoming.trim().toLowerCase();
}
