import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TrendData } from '../../types';
import EmptyState from '../ui/EmptyState';

interface MonthlyBarProps {
  data: TrendData[];
}

const formatIndianCurrency = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatMonth = (month: string) => {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};

interface TooltipPayload { name: string; value: number; color: string; }

const CustomTooltip = ({
  active, payload, label,
}: { active?: boolean; payload?: TooltipPayload[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label ? formatMonth(label) : ''}</p>
        {payload.map((entry) => (
          <p key={entry.name} style={{ color: entry.color }} className="chart-tooltip-value">
            {entry.name}: {formatIndianCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const MonthlyBar: React.FC<MonthlyBarProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <EmptyState icon="📊" title="No data" description="Not enough data to show bars." />;
  }

  const formattedData = data.map((d) => ({ ...d, monthLabel: formatMonth(d.month) }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={formattedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
        <YAxis
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="income"  name="Income"  fill="#10B981" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expense" name="Expense" fill="#EF4444" radius={[3, 3, 0, 0]} />
        <Bar dataKey="savings" name="Savings" fill="#3B82F6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default MonthlyBar;
