import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
}

const getPersistedUser = (): User | null => {
  try {
    const stored = sessionStorage.getItem('finance_user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getPersistedUser(),
  accessToken: null,
  setAuth: (user: User, accessToken: string) => {
    try {
      sessionStorage.setItem('finance_user', JSON.stringify(user));
    } catch {
      // ignore storage errors
    }
    set({ user, accessToken });
  },
  clearAuth: () => {
    try {
      sessionStorage.removeItem('finance_user');
    } catch {
      // ignore storage errors
    }
    set({ user: null, accessToken: null });
  },
}));
