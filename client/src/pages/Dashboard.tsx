import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMonthlyReport, useCategoryBreakdown, useTrends } from '../hooks/useReports';
import { useTransactions } from '../hooks/useTransactions';
import { useDashboardConfig } from '../hooks/useDashboardConfig';
import WidgetRenderer from '../components/dashboard/WidgetRenderer';
import type { DashboardWidget } from '../types';

const formatAmount = (amount: number) =>
  `₹${Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getMonthString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const formatMonthLabel = (monthStr: string) => {
  const [y, m] = monthStr.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
};

const FALLBACK_WIDGETS: DashboardWidget[] = [
  { id: 'f-income',    type: 'stat',           enabled: true, position: 0, colSpan: 3,  rowSpan: 1, config: { metric: 'income',            label: 'Total Income' } },
  { id: 'f-expense',   type: 'stat',           enabled: true, position: 1, colSpan: 3,  rowSpan: 1, config: { metric: 'expense',           label: 'Total Expense' } },
  { id: 'f-savings',   type: 'stat',           enabled: true, position: 2, colSpan: 3,  rowSpan: 1, config: { metric: 'savings',           label: 'Net Savings' } },
  { id: 'f-txcount',   type: 'stat',           enabled: true, position: 3, colSpan: 3,  rowSpan: 1, config: { metric: 'transaction_count', label: 'Transactions' } },
  { id: 'f-pie',       type: 'pie',            enabled: true, position: 4, colSpan: 6,  rowSpan: 2, config: { title: 'Payment Types' } },
  { id: 'f-bank',      type: 'bank_breakdown', enabled: true, position: 5, colSpan: 6,  rowSpan: 2, config: { title: 'Category Breakdown', limit: 6 } },
  { id: 'f-line',      type: 'line',           enabled: true, position: 6, colSpan: 12, rowSpan: 2, config: { months: 6, title: 'Monthly Volume' } },
  { id: 'f-table',     type: 'table',          enabled: true, position: 7, colSpan: 12, rowSpan: 3, config: { source: 'recent_transactions', limit: 10, title: 'Transaction Overview' } },
];

const Dashboard: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const month = getMonthString(currentDate);

  const { data: report }     = useMonthlyReport(month);
  const { data: breakdown }  = useCategoryBreakdown(month);
  const { data: trends }     = useTrends(6);
  const { data: recentTx }   = useTransactions({ limit: 10, page: 1 });
  const { data: dashConfig } = useDashboardConfig();

  


  const allWidgets = dashConfig?.widgets ?? FALLBACK_WIDGETS;
  const enabled    = allWidgets
    .filter((w) => w.enabled)
    .sort((a, b) => a.position - b.position);


  return (
    <div className="page dashboard-page">

   

      {/* ── Widget grid ─────────────────────────────────────────── */}
      <div className="dashboard-widget-grid">
        {enabled.map((w) => (
          <WidgetRenderer
            key={w.id}
            widget={w}
            month={month}
            report={report}
            breakdown={breakdown}
            trends={trends}
            transactions={recentTx}
          />
        ))}
      </div>

    </div>
  );
};

export default Dashboard;
