/** Fixe TN : numéro national commençant par 7 → pas de WhatsApp. */
export function isFixedLinePhone(raw?: string | null, defaultCountryCode = '216'): boolean {
  if (!raw?.trim()) return false;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith(defaultCountryCode)) digits = digits.slice(defaultCountryCode.length);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.startsWith('7');
}

/** Retourne le numéro seulement s’il est éligible WhatsApp (pas un fixe 7x). */
export function whatsappEligiblePhone(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  if (isFixedLinePhone(raw)) return null;
  return raw.trim();
}

export function waLink(phone: string, draft?: string | null): string {
  const digits = phone.replace(/\D/g, '');
  const base = `https://wa.me/${digits}`;
  if (draft?.trim()) return `${base}?text=${encodeURIComponent(draft.trim())}`;
  return base;
}

export function mapsLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function mailtoLink(email: string, draft?: string | null, company?: string): string {
  const subject = encodeURIComponent(company ? `Suite — ${company}` : 'Suite');
  if (draft?.trim()) {
    return `mailto:${email}?subject=${subject}&body=${encodeURIComponent(draft.trim())}`;
  }
  return `mailto:${email}?subject=${subject}`;
}

export function siteHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
