import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import type { Budget } from '../types';

const fetchBudgets = async (month?: string): Promise<Budget[]> => {
  const params = month ? `?month=${month}` : '';
  const response = await apiClient.get<{ data: Budget[] }>(`/api/budgets${params}`);
  return response.data.data;
};

export const useBudgets = (month?: string) => {
  return useQuery({
    queryKey: ['budgets', month],
    queryFn: () => fetchBudgets(month),
  });
};

export const useCreateBudget = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Budget>) =>
      apiClient.post<{ data: Budget }>('/api/budgets', data).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
};

export const useUpdateBudget = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Budget> & { id: string }) =>
      apiClient.patch<{ data: Budget }>(`/api/budgets/${id}`, data).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
};

export const useDeleteBudget = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/budgets/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
};
