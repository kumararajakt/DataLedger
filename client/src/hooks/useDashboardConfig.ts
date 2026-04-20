import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardConfigApi } from '../api/dashboardConfig';
import type { DashboardWidget } from '../types';

const DASHBOARD_KEY = ['dashboard-config'] as const;

export function useDashboardConfig() {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: async () => {
      const res = await dashboardConfigApi.get();
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveDashboardConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (widgets: DashboardWidget[]) => dashboardConfigApi.save(widgets),
    onSuccess: () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  });
}

export function useResetDashboardConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => dashboardConfigApi.reset(),
    onSuccess: () => qc.invalidateQueries({ queryKey: DASHBOARD_KEY }),
  });
}
