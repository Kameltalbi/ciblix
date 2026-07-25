import { api } from '@/lib/api';

/**
 * Après login / Google : Mission IA si pas encore ACTIVE, sinon dashboard.
 * SUPERADMIN → /admin.
 */
export async function resolvePostLoginPath(role?: string | null): Promise<string> {
  if (role === 'SUPERADMIN') return '/admin';

  try {
    localStorage.removeItem('onboardingCompleted');
    const { data } = await api.get<{ configured?: boolean }>('/mission/status');
    if (!data?.configured) return '/mission';
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    // Paiement / accès bloqué : ne pas forcer la mission
    if (status === 402 || status === 403) return '/dashboard';
    return '/mission';
  }

  return '/dashboard';
}
