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
