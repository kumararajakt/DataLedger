export interface User {
  id: string;
  email: string;
}

export type InstrumentType =
  | 'mutual_fund'
  | 'sip'
  | 'stock'
  | 'fd'
  | 'ppf'
  | 'nps'
  | 'bond'
  | 'gold'
  | 'silver';

export interface InvestmentDetails {
  instrument_type: InstrumentType;
  instrument_name?: string;
  units?: number;
  quantity?: number;
  nav_or_price?: number;
  folio_number?: string;
  platform?: string;
  interest_rate?: number;
  maturity_date?: string;
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
  investmentDetails?: InvestmentDetails | null;
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

// ── Dashboard widget types ────────────────────────────────────────────────────

export type WidgetType  = 'stat' | 'pie' | 'line' | 'bar' | 'table' | 'bank_breakdown';
export type StatMetric  = 'income' | 'expense' | 'savings' | 'transaction_count';
export type TableSource = 'recent_transactions' | 'top_categories';

export interface StatWidgetConfig          { metric: StatMetric; label?: string; }
export interface PieWidgetConfig           { title?: string; }
export interface LineWidgetConfig          { months: number; title?: string; }
export interface BarWidgetConfig           { months: number; title?: string; }
export interface TableWidgetConfig         { source: TableSource; limit: number; title?: string; }
export interface BankBreakdownWidgetConfig { title?: string; limit?: number; }
export type WidgetConfig =
  | StatWidgetConfig
  | PieWidgetConfig
  | LineWidgetConfig
  | BarWidgetConfig
  | TableWidgetConfig
  | BankBreakdownWidgetConfig;

export interface DashboardWidget {
  id:       string;
  type:     WidgetType;
  enabled:  boolean;
  position: number;
  colSpan:  number;
  rowSpan:  number;
  config:   WidgetConfig;
}

export interface DashboardConfig {
  widgets: DashboardWidget[];
}
