import React from 'react';
import type { TableSource } from '../../types';
import { useTransactions } from '../../hooks/useTransactions';
import { useCategoryBreakdown } from '../../hooks/useReports';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';

interface WidgetDataTableProps {
  source: TableSource;
  limit:  number;
  month:  string;
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const formatAmount = (amount: number) =>
  `₹${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const WidgetDataTable: React.FC<WidgetDataTableProps> = ({ source, limit, month }) => {
  const { data: txData, isLoading: txLoading } = useTransactions(
    { limit, page: 1 },
    source === 'recent_transactions'
  );
  const { data: breakdown, isLoading: bLoading } = useCategoryBreakdown(
    source === 'top_categories' ? month : ''
  );

  if (source === 'recent_transactions') {
    if (txLoading) return <LoadingSpinner centered />;
    const rows = txData?.data ?? [];
    if (rows.length === 0) return <EmptyState icon="💳" title="No transactions" description="No recent transactions to show." />;
    return (
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr key={tx.id}>
                <td className="td-date">{formatDate(tx.date)}</td>
                <td className="td-desc" title={tx.description}>
                  <div>{tx.description}</div>
                  {tx.notes && <div className="td-note">{tx.notes}</div>}
                </td>
                <td className={`td-amount ${tx.type === 'income' ? 'amount-income' : tx.type === 'expense' ? 'amount-expense' : 'amount-transfer'}`}>
                  {tx.type === 'expense' ? '-' : '+'}{formatAmount(tx.amount)}
                </td>
                <td>
                  <span className={`badge badge-type-${tx.type}`}>{tx.type}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // top_categories
  if (bLoading) return <LoadingSpinner centered />;
  const cats = (breakdown ?? []).slice(0, limit);
  if (cats.length === 0) return <EmptyState icon="🏷️" title="No data" description="No category data for this period." />;
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Amount</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
          {cats.map((cat) => (
            <tr key={cat.category}>
              <td>{cat.category}</td>
              <td className="td-amount amount-expense">{formatAmount(cat.amount)}</td>
              <td>{cat.percentage.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default WidgetDataTable;
