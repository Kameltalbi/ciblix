import axios from 'axios';
import { useAuth } from './auth';

/** Base API : relatif `/api` (même origine) ou URL absolue / chemin au build (`VITE_API_URL`, idéalement se terminer par `/api`). */
function resolveApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!raw) return '/api';
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, '');
  if (raw.startsWith('/')) return raw.replace(/\/$/, '') || '/api';
  return '/api';
}

const API_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

const isAuthEndpointWithoutBearer = (url?: string) =>
  !!url && [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/logout',
    '/auth/forgot-password',
    '/auth/reset-password',
  ].some((path) => url.startsWith(path));

// Injection du token JWT à chaque requête
api.interceptors.request.use(config => {
  if (!isAuthEndpointWithoutBearer(config.url)) {
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  } else if (config.headers.Authorization) {
    delete config.headers.Authorization;
  }
  return config;
});

// Logout auto en cas de 401 avec tentative de refresh
api.interceptors.response.use(
  r => r,
  async err => {
    const originalRequest = err.config;

    if (
      err.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpointWithoutBearer(originalRequest.url)
    ) {
      originalRequest._retry = true;

      try {
        const auth = useAuth.getState();
        await auth.refreshAccessToken();

        // Retry original request with new token
        const newAccessToken = localStorage.getItem('accessToken');
        if (newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout and redirect
        const auth = useAuth.getState();
        await auth.logout();
        if (window.location.pathname !== '/login') window.location.href = '/login';
      }
    }

    return Promise.reject(err);
  }
);
