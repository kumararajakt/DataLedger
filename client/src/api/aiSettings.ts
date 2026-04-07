import apiClient from './client';
import type { AiSettings, AiSettingsPayload } from '../types';

interface TestResult {
  ok: boolean;
  reply?: string;
  error?: string;
  latencyMs: number;
}

export const aiSettingsApi = {
  get: () =>
    apiClient.get<{ data: AiSettings | null }>('/api/settings/ai'),

  save: (payload: AiSettingsPayload) =>
    apiClient.post<{ data: { ok: boolean } }>('/api/settings/ai', payload),

  remove: () =>
    apiClient.delete<{ data: { ok: boolean } }>('/api/settings/ai'),

  test: () =>
    apiClient.post<{ data: TestResult }>('/api/settings/ai/test'),
};
