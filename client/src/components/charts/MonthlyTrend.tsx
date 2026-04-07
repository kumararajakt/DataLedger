import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TrendData } from '../../types';
import EmptyState from '../ui/EmptyState';

interface MonthlyTrendProps {
  data: TrendData[];
}

const formatIndianCurrency = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatMonth = (month: string) => {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) => {
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

const MonthlyTrend: React.FC<MonthlyTrendProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <EmptyState icon="📈" title="No trend data" description="Not enough data to show trends." />;
  }

  const formattedData = data.map((d) => ({
    ...d,
    monthLabel: formatMonth(d.month),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formattedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="monthLabel"
          tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
        />
        <YAxis
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line
          type="monotone"
          dataKey="income"
          name="Income"
          stroke="#10B981"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="expense"
          name="Expense"
          stroke="#EF4444"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="savings"
          name="Savings"
          stroke="#3B82F6"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default MonthlyTrend;
