import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import type { MonthlyReport, CategoryBreakdown, TrendData } from '../types';

interface MonthlyReportRaw {
  month: string;
  total_income: number;
  total_expense: number;
  savings: number;
}

export const useMonthlyReport = (month: string) => {
  return useQuery({
    queryKey: ['reports', 'monthly', month],
    queryFn: async () => {
      const response = await apiClient.get<{ data: MonthlyReportRaw }>(`/api/reports/monthly?month=${month}`);
      const raw = response.data.data;
      const result: MonthlyReport = {
        month: raw.month,
        totalIncome: raw.total_income,
        totalExpense: raw.total_expense,
        netSavings: raw.savings,
      };
      return result;
    },
    enabled: !!month,
  });
};

export const useCategoryBreakdown = (month: string) => {
  return useQuery({
    queryKey: ['reports', 'category-breakdown', month],
    queryFn: async () => {
      const response = await apiClient.get<{ data: CategoryBreakdown[] }>(`/api/reports/category-breakdown?month=${month}`);
      return response.data.data;
    },
    enabled: !!month,
  });
};

export const useTrends = (months: number = 6) => {
  return useQuery({
    queryKey: ['reports', 'trends', months],
    queryFn: async () => {
      const response = await apiClient.get<{ data: TrendData[] }>(`/api/reports/trends?months=${months}`);
      return response.data.data;
    },
    enabled: months > 0,
  });
};
