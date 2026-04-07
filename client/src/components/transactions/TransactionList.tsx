import React from 'react';
import type { Transaction } from '../../types';
import TransactionRow from './TransactionRow';
import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';

interface TransactionListProps {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onPageChange: (page: number) => void;
  onAddNew?: () => void;
}

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  total,
  page,
  limit,
  isLoading,
  onEdit,
  onDelete,
  onPageChange,
  onAddNew,
}) => {
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  if (isLoading) {
    return <LoadingSpinner centered />;
  }

  if (!transactions.length) {
    return (
      <EmptyState
        icon="💳"
        title="No transactions found"
        description="Try adjusting your filters or add a new transaction."
        actionLabel={onAddNew ? 'Add Transaction' : undefined}
        onAction={onAddNew}
      />
    );
  }

  return (
    <div className="transaction-list">
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <TransactionRow
                key={t.id}
                transaction={t}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <span className="pagination-info">
            Showing {start}–{end} of {total}
          </span>
          <div className="pagination-controls">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              &larr; Prev
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === totalPages ||
                  Math.abs(p - page) <= 2
              )
              .reduce<(number | string)[]>((acc, p, idx, arr) => {
                if (idx > 0 && Number(arr[idx - 1]) + 1 < p) {
                  acc.push('...');
                }
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                    ...
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => onPageChange(Number(p))}
                  >
                    {p}
                  </Button>
                )
              )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next &rarr;
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionList;
