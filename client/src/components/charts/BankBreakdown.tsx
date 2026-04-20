import React from 'react';
import type { CategoryBreakdown } from '../../types';
import EmptyState from '../ui/EmptyState';

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

const formatAmount = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

interface BankBreakdownProps {
  data:  CategoryBreakdown[];
  limit?: number;
}

const BankBreakdown: React.FC<BankBreakdownProps> = ({ data, limit = 6 }) => {
  if (!data || data.length === 0) {
    return <EmptyState icon="🏦" title="No data" description="No category data for this period." />;
  }

  const rows = data.slice(0, limit);
  const maxAmount = rows[0]?.amount ?? 1;

  return (
    <div className="bank-breakdown-list">
      {rows.map((row, idx) => (
        <div key={row.category} className="bank-breakdown-row">
          <div className="bank-breakdown-rank">{idx + 1}</div>
          <div className="bank-breakdown-body">
            <div className="bank-breakdown-meta">
              <span className="bank-breakdown-name">{row.category}</span>
              <span className="bank-breakdown-pct">{row.percentage.toFixed(1)}%</span>
            </div>
            <div className="bank-breakdown-track">
              <div
                className="bank-breakdown-fill"
                style={{
                  width: `${(row.amount / maxAmount) * 100}%`,
                  background: COLORS[idx % COLORS.length],
                }}
              />
            </div>
            <span className="bank-breakdown-amount">{formatAmount(row.amount)}</span>
          </div>
          <div
            className="bank-breakdown-dot"
            style={{ background: COLORS[idx % COLORS.length] }}
          />
        </div>
      ))}
    </div>
  );
};

export default BankBreakdown;
