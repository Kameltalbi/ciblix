import type { ReactNode } from 'react';

/** Icônes marque simplifiées (SVG) — une seule API pour toutes les cartes. */
export function ConnectorBrandIcon({ id, className }: { id: string; className?: string }): ReactNode {
  const cn = className ?? 'h-6 w-6';
  switch (id) {
    case 'gmail':
      return (
        <svg viewBox="0 0 24 24" className={cn} aria-hidden>
          <path fill="#EA4335" d="M3 5.5A2.5 2.5 0 015.5 3h13A2.5 2.5 0 0121 5.5v13a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 18.5v-13z" opacity=".12" />
          <path fill="#EA4335" d="M5 7l7 5.25L19 7v10H5V7z" />
          <path fill="#FBBC04" d="M5 7v10l4.5-4.5L5 7z" />
          <path fill="#34A853" d="M19 7v10l-4.5-4.5L19 7z" />
          <path fill="#4285F4" d="M5 7l7 5.25L19 7l-2.2-1.65L12 8.4 7.2 5.35 5 7z" />
        </svg>
      );
    case 'outlook':
      return (
        <svg viewBox="0 0 24 24" className={cn} aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" fill="#0078D4" />
          <path fill="#fff" d="M6.5 9.2c1.5 1.1 3 2.2 5.5 4.1 2.5-1.9 4-3 5.5-4.1v1.5c-1.4 1-2.9 2.2-5.5 4.2-2.6-2-4.1-3.2-5.5-4.2V9.2z" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg viewBox="0 0 24 24" className={cn} aria-hidden>
          <path
            fill="#25D366"
            d="M12 2a9.9 9.9 0 00-8.5 14.9L2 22l5.3-1.4A9.9 9.9 0 1012 2zm0 1.8a8.1 8.1 0 018.1 8.1 8.1 8.1 0 01-12.2 7l-.4-.2-3.1.8.8-3-.2-.4A8.1 8.1 0 0112 3.8zm4.5 11.6c-.2.6-1.2 1.1-1.7 1.1-.4 0-.8.2-2.7-.6-2.4-1-3.9-3.5-4-3.7-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2 0 .4-.1.6l-.4.5c-.1.2-.3.3-.1.6.2.3.7 1.2 1.6 1.9 1.1.9 2 1.2 2.3 1.3.3.1.5.1.7-.1l.6-.7c.2-.2.4-.2.6-.1l1.8.8c.2.1.4.2.4.4 0 .2 0 1.1-.5 1.7z"
          />
        </svg>
      );
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" className={cn} aria-hidden>
          <rect width="24" height="24" rx="4" fill="#0A66C2" />
          <path fill="#fff" d="M7.1 9.4h2.2v7.3H7.1V9.4zM8.2 6.3a1.3 1.3 0 110 2.5 1.3 1.3 0 010-2.5zM11.2 9.4h2.1v1h0c.3-.6 1.1-1.2 2.3-1.2 2.4 0 2.9 1.6 2.9 3.7v3.8h-2.2v-3.4c0-.8 0-1.9-1.1-1.9s-1.3.9-1.3 1.8v3.5h-2.2V9.4z" />
        </svg>
      );
    case 'google-calendar':
      return (
        <svg viewBox="0 0 24 24" className={cn} aria-hidden>
          <rect x="3" y="4" width="18" height="17" rx="2" fill="#fff" stroke="#DADCE0" />
          <path fill="#4285F4" d="M3 8h18v2H3z" />
          <path fill="#EA4335" d="M7 3h2v3H7z" />
          <path fill="#FBBC04" d="M15 3h2v3h-2z" />
          <text x="12" y="18" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1967D2">
            31
          </text>
        </svg>
      );
    case 'microsoft-365':
      return (
        <svg viewBox="0 0 24 24" className={cn} aria-hidden>
          <path fill="#F25022" d="M3 3h8v8H3z" />
          <path fill="#7FBA00" d="M13 3h8v8h-8z" />
          <path fill="#00A4EF" d="M3 13h8v8H3z" />
          <path fill="#FFB900" d="M13 13h8v8h-8z" />
        </svg>
      );
    case 'website':
      return (
        <svg viewBox="0 0 24 24" className={cn} aria-hidden>
          <circle cx="12" cy="12" r="9" fill="#016AEB" opacity=".15" />
          <circle cx="12" cy="12" r="9" fill="none" stroke="#016AEB" strokeWidth="1.6" />
          <path d="M3 12h18M12 3c2.5 2.8 3.8 5.8 3.8 9S14.5 18.2 12 21c-2.5-2.8-3.8-5.8-3.8-9S9.5 5.8 12 3z" fill="none" stroke="#016AEB" strokeWidth="1.4" />
        </svg>
      );
    case 'crm':
      return (
        <svg viewBox="0 0 24 24" className={cn} aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" fill="#6366F1" />
          <path fill="#fff" d="M7 10h4v1.2H7V10zm0 3h10v1.2H7V13zm6-3h4v1.2h-4V10z" />
        </svg>
      );
    case 'erp':
      return (
        <svg viewBox="0 0 24 24" className={cn} aria-hidden>
          <rect x="4" y="4" width="16" height="16" rx="3" fill="#0F766E" />
          <path fill="#fff" d="M8 8h8v1.5H8V8zm0 3.5h8V13H8v-1.5zm0 3.5h5V18H8v-1.5z" />
        </svg>
      );
    case 'rne':
      return (
        <svg viewBox="0 0 24 24" className={cn} aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="2" fill="#B45309" />
          <path fill="#fff" d="M7 8h10v1.4H7V8zm0 3h10v1.4H7V11zm0 3h6V15.4H7V14z" />
        </svg>
      );
    case 'tuneps':
      return (
        <svg viewBox="0 0 24 24" className={cn} aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="2" fill="#1D4ED8" />
          <path fill="#fff" d="M6.5 8.5h11v1.3h-11V8.5zm0 3h8v1.3h-8v-1.3zm0 3h10v1.3h-10v-1.3z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={cn} aria-hidden>
          <circle cx="12" cy="12" r="9" fill="#E5E7EB" />
          <path d="M8 12h8M12 8v8" stroke="#6B7280" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
  }
}
