import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiSettingsApi } from '../api/aiSettings';
import type { AiSettingsPayload } from '../types';

const AI_KEY = ['ai-settings'] as const;

export function useAiSettings() {
  return useQuery({
    queryKey: AI_KEY,
    queryFn: async () => {
      const res = await aiSettingsApi.get();
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveAiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AiSettingsPayload) => aiSettingsApi.save(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: AI_KEY }),
  });
}

export function useDeleteAiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => aiSettingsApi.remove(),
    onSuccess: () => qc.invalidateQueries({ queryKey: AI_KEY }),
  });
}

export function useTestAiConnection() {
  return useMutation({
    mutationFn: () => aiSettingsApi.test(),
  });
}
