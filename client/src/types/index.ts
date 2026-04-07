export interface User {
  id: string;
  email: string;
}

export interface Category {
  id: string;
  userId: string | null;
  name: string;
  color: string;
  icon: string;
  isSystem: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  categoryId: string | null;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  source: 'csv' | 'pdf' | 'manual' | 'plaid';
  hash: string | null;
  notes: string | null;
  createdAt: string;
  category?: Category;
}

export type AiProvider = 'anthropic' | 'openai' | 'openrouter' | 'local';

export interface AiSettings {
  enabled: boolean;
  provider: AiProvider;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  maskedApiKey: string;
}

export interface AiSettingsPayload {
  enabled: boolean;
  provider: AiProvider;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  month: string;
  amount: number;
  spent: number;
  category?: Category;
}

export interface MonthlyReport {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  month: string;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

export interface TrendData {
  month: string;
  income: number;
  expense: number;
  savings: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface TransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  type?: 'income' | 'expense' | 'transfer' | '';
  search?: string;
  page?: number;
  limit?: number;
}
