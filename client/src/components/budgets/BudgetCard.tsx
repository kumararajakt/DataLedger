import React from 'react';
import type { Budget } from '../../types';
import Button from '../ui/Button';

interface BudgetCardProps {
  budget: Budget;
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
}

const formatAmount = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatMonth = (month: string) => {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const BudgetCard: React.FC<BudgetCardProps> = ({ budget, onEdit, onDelete }) => {
  const percentage = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;
  const isOverBudget = budget.spent > budget.amount;
  const remaining = budget.amount - budget.spent;

  return (
    <div className={`budget-card ${isOverBudget ? 'budget-card-over' : ''}`}>
      <div className="budget-card-header">
        <div className="budget-card-category">
          {budget.category && (
            <span
              className="budget-category-icon"
              style={{ color: budget.category.color }}
            >
              {budget.category.icon}
            </span>
          )}
          <div>
            <h3 className="budget-card-name">
              {budget.category?.name ?? 'Unknown Category'}
            </h3>
            <p className="budget-card-month">{formatMonth(budget.month)}</p>
          </div>
        </div>
        <div className="budget-card-actions">
          <Button variant="ghost" size="sm" onClick={() => onEdit(budget)} title="Edit">
            ✏️
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(budget.id)}
            title="Delete"
          >
            🗑️
          </Button>
        </div>
      </div>

      <div className="budget-amounts">
        <div className="budget-amount-row">
          <span className="budget-label">Spent</span>
          <span className={`budget-spent ${isOverBudget ? 'text-danger' : ''}`}>
            {formatAmount(budget.spent)}
          </span>
        </div>
        <div className="budget-amount-row">
          <span className="budget-label">Budget</span>
          <span className="budget-total">{formatAmount(budget.amount)}</span>
        </div>
        <div className="budget-amount-row">
          <span className="budget-label">{isOverBudget ? 'Over by' : 'Remaining'}</span>
          <span className={`budget-remaining ${isOverBudget ? 'text-danger' : 'text-success'}`}>
            {isOverBudget ? '-' : ''}{formatAmount(Math.abs(remaining))}
          </span>
        </div>
      </div>

      <div className="budget-progress-container">
        <div
          className={`budget-progress-bar ${isOverBudget ? 'budget-progress-over' : ''}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="budget-progress-label">
        <span>{percentage.toFixed(1)}% used</span>
        {isOverBudget && <span className="badge badge-danger">Over budget!</span>}
      </div>
    </div>
  );
};

export default BudgetCard;
