import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { CategoryBreakdown } from '../../types';
import EmptyState from '../ui/EmptyState';

interface SpendingDonutProps {
  data: CategoryBreakdown[];
}

const DEFAULT_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#6366F1',
  '#84CC16',
];

const formatIndianCurrency = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface TooltipPayload {
  name: string;
  value: number;
  payload: CategoryBreakdown;
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{entry.name}</p>
        <p className="chart-tooltip-value">{formatIndianCurrency(entry.value)}</p>
        <p className="chart-tooltip-pct">{entry.payload.percentage.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
};

const SpendingDonut: React.FC<SpendingDonutProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <EmptyState icon="🍩" title="No spending data" description="No expense data for this month." />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="amount"
          nameKey="category"
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default SpendingDonut;
