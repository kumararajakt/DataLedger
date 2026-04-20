import React from 'react';
import type {
  DashboardWidget,
  MonthlyReport,
  CategoryBreakdown,
  TrendData,
  PaginatedResponse,
  Transaction,
  StatWidgetConfig,
  LineWidgetConfig,
  BarWidgetConfig,
  TableWidgetConfig,
  BankBreakdownWidgetConfig,
} from '../../types';
import StatCard from '../ui/StatCard';
import SpendingDonut from '../charts/SpendingDonut';
import MonthlyTrend from '../charts/MonthlyTrend';
import MonthlyBar from '../charts/MonthlyBar';
import WidgetDataTable from '../charts/WidgetDataTable';
import BankBreakdown from '../charts/BankBreakdown';
import { useTrends } from '../../hooks/useReports';
import LoadingSpinner from '../ui/LoadingSpinner';

interface WidgetRendererProps {
  widget:        DashboardWidget;
  month:         string;
  report?:       MonthlyReport | null;
  breakdown?:    CategoryBreakdown[];
  trends?:       TrendData[];
  transactions?: PaginatedResponse<Transaction>;
  style?:        React.CSSProperties;
}

const formatAmount = (amount: number) =>
  `₹${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TrendWidget: React.FC<{
  type: 'line' | 'bar';
  config: LineWidgetConfig | BarWidgetConfig;
  defaultTrends?: TrendData[];
}> = ({ type, config, defaultTrends }) => {
  const months = config.months ?? 6;
  const needsFetch = months !== 6;
  const { data: ownTrends, isLoading } = useTrends(needsFetch ? months : 0);
  const data = needsFetch ? (ownTrends ?? []) : (defaultTrends ?? []);
  if (needsFetch && isLoading) return <LoadingSpinner centered />;
  return type === 'bar' ? <MonthlyBar data={data} /> : <MonthlyTrend data={data} />;
};

const WidgetRenderer: React.FC<WidgetRendererProps> = ({
  widget, month, report, breakdown, trends, transactions, style,
}) => {
  const { type, config, colSpan = 12, rowSpan = 1 } = widget;

  const cellStyle: React.CSSProperties = {
    gridColumn: `span ${colSpan}`,
    gridRow:    `span ${rowSpan}`,
    ...style,
  };

  // ── Stat widget ─────────────────────────────────────────────────────────────
  if (type === 'stat') {
    const cfg   = config as StatWidgetConfig;
    const label = cfg.label ?? cfg.metric;

    let value: string = '—';
    let icon: 'trend' | 'wallet' | 'spark' = 'wallet';
    let tone: 'success' | 'danger' | 'accent' | 'default' = 'default';

    switch (cfg.metric) {
      case 'income':
        value = formatAmount(report?.totalIncome ?? 0);
        icon  = 'trend';
        tone  = 'success';
        break;
      case 'expense':
        value = formatAmount(report?.totalExpense ?? 0);
        icon  = 'wallet';
        tone  = 'danger';
        break;
      case 'savings':
        value = `${(report?.netSavings ?? 0) < 0 ? '-' : ''}${formatAmount(report?.netSavings ?? 0)}`;
        icon  = 'spark';
        tone  = (report?.netSavings ?? 0) >= 0 ? 'accent' : 'danger';
        break;
      case 'transaction_count':
        value = String(transactions?.total ?? 0);
        icon  = 'transactions' as any;
        tone  = 'default';
        break;
    }

    return (
      <div style={cellStyle} className="dashboard-widget-cell">
        <StatCard label={label} value={value} icon={icon} tone={tone} />
      </div>
    );
  }

  // ── Non-stat — wrapped in card ───────────────────────────────────────────────
  const title = (config as { title?: string }).title;

  let content: React.ReactNode = null;

  switch (type) {
    case 'pie':
      content = <SpendingDonut data={breakdown ?? []} />;
      break;
    case 'line':
      content = (
        <TrendWidget type="line" config={config as LineWidgetConfig} defaultTrends={trends} />
      );
      break;
    case 'bar':
      content = (
        <TrendWidget type="bar" config={config as BarWidgetConfig} defaultTrends={trends} />
      );
      break;
    case 'table': {
      const cfg = config as TableWidgetConfig;
      content = <WidgetDataTable source={cfg.source} limit={cfg.limit} month={month} />;
      break;
    }
    case 'bank_breakdown': {
      const cfg = config as BankBreakdownWidgetConfig;
      content = <BankBreakdown data={breakdown ?? []} limit={cfg.limit ?? 6} />;
      break;
    }
    default:
      return null;
  }

  return (
    <div style={cellStyle} className="dashboard-widget-cell">
      <div className="card chart-card">
        {title && (
          <div className="card-header">
            <h2 className="card-title">{title}</h2>
          </div>
        )}
        {content}
      </div>
    </div>
  );
};

export default WidgetRenderer;
