import React from 'react';
import type { Transaction } from '../../types';
import Button from '../ui/Button';

interface TransactionRowProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatAmount = (amount: number) =>
  `₹${Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  onEdit,
  onDelete,
}) => {
  const isUncategorized = !transaction.categoryId;
  const amountClass =
    transaction.type === 'income'
      ? 'amount-income'
      : transaction.type === 'expense'
      ? 'amount-expense'
      : 'amount-transfer';

  return (
    <tr className={isUncategorized ? 'row-uncategorized' : ''}>
      <td className="td-date">{formatDate(transaction.date)}</td>
      <td className="td-desc" title={transaction.description}>
        <div>{transaction.description}</div>
        {transaction.notes && (
          <div style={{ fontSize: '0.78rem', color: '#6366f1', marginTop: '0.2rem', fontStyle: 'italic' }}>
            {transaction.notes}
          </div>
        )}
      </td>
      <td className="td-category">
        {transaction.category ? (
          <span
            className="badge"
            style={{
              backgroundColor: transaction.category.color + '22',
              color: transaction.category.color,
              borderColor: transaction.category.color + '44',
            }}
          >
            {transaction.category.icon} {transaction.category.name}
          </span>
        ) : (
          <span className="badge badge-uncategorized">Uncategorized</span>
        )}
      </td>
      <td className={`td-amount ${amountClass}`}>
        {transaction.type === 'expense' ? '-' : '+'}
        {formatAmount(transaction.amount)}
      </td>
      <td className="td-type">
        <span className={`badge badge-type-${transaction.type}`}>
          {transaction.type}
        </span>
      </td>
      <td className="td-actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(transaction)}
          title="Edit"
        >
          ✏️
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(transaction.id)}
          title="Delete"
        >
          🗑️
        </Button>
      </td>
    </tr>
  );
};

export default TransactionRow;
