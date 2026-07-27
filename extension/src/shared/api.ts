import { getValidSession } from './auth.js';

export async function apiCall<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH',
  body?: unknown
): Promise<T> {
  const session = await getValidSession();
  if (!session) throw new Error('CONNECT_REQUIRED');

  const res = await fetch(`${session.apiBase}/connect-ai${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    throw new Error('CONNECT_REQUIRED');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Erreur ${res.status}`);
  }
  return res.json() as Promise<T>;
}
