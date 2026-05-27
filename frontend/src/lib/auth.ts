import { create } from 'zustand';
import { api } from './api';
import type { User } from '../types';

function readStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  paymentStatus: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
}

function clearAuthStorage() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('paymentStatus');
  localStorage.removeItem('impersonating');
  localStorage.removeItem('originalToken');
}

export const useAuth = create<AuthState>((set, get) => ({
  user: readStoredUser(),
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  paymentStatus: localStorage.getItem('paymentStatus'),
  loading: false,

  login: async (email, password) => {
    clearAuthStorage();
    set({ loading: true });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('paymentStatus', data.paymentStatus || 'PENDING');
      set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, paymentStatus: data.paymentStatus || 'PENDING', loading: false });
    } catch (e) {
      clearAuthStorage();
      set({ user: null, accessToken: null, refreshToken: null, paymentStatus: null, loading: false });
      throw e;
    }
  },

  logout: async () => {
    const refreshToken = get().refreshToken;
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // Ignore logout errors
    }
    clearAuthStorage();
    set({ user: null, accessToken: null, refreshToken: null, paymentStatus: null });
  },

  fetchMe: async () => {
    const accessToken = get().accessToken;
    if (!accessToken) return;
    try {
      const { data } = await api.get('/auth/me');
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('paymentStatus', data.paymentStatus || 'PENDING');
      set({ user: data.user, paymentStatus: data.paymentStatus || 'PENDING' });
    } catch {
      const refreshToken = get().refreshToken;
      if (refreshToken) {
        try {
          await get().refreshAccessToken();
          const { data } = await api.get('/auth/me');
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('paymentStatus', data.paymentStatus || 'PENDING');
          set({ user: data.user, paymentStatus: data.paymentStatus || 'PENDING' });
          return;
        } catch {
          // refresh échoué
        }
      }
      clearAuthStorage();
      set({ user: null, accessToken: null, refreshToken: null, paymentStatus: null });
    }
  },

  refreshAccessToken: async () => {
    const refreshToken = get().refreshToken;
    if (!refreshToken) {
      throw new Error('Refresh token manquant');
    }

    try {
      const { data } = await api.post('/auth/refresh', { refreshToken });
      localStorage.setItem('accessToken', data.accessToken);
      set({ accessToken: data.accessToken });
    } catch {
      // Refresh failed, logout
      await get().logout();
      throw new Error('Refresh token invalide ou expiré');
    }
  },
}));
