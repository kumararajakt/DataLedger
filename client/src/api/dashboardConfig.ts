import apiClient from './client';
import type { DashboardConfig, DashboardWidget } from '../types';

export const dashboardConfigApi = {
  get: () =>
    apiClient.get<{ data: DashboardConfig }>('/api/settings/dashboard'),

  save: (widgets: DashboardWidget[]) =>
    apiClient.post<{ data: { ok: boolean } }>('/api/settings/dashboard', { widgets }),

  reset: () =>
    apiClient.delete<{ data: { ok: boolean } }>('/api/settings/dashboard'),
};
