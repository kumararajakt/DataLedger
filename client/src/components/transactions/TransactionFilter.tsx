import React from 'react';
import type { Category, TransactionFilters } from '../../types';
import Button from '../ui/Button';

interface TransactionFilterProps {
  filters: TransactionFilters;
  categories: Category[];
  onChange: (filters: TransactionFilters) => void;
  onClear: () => void;
}

const TransactionFilter: React.FC<TransactionFilterProps> = ({
  filters,
  categories,
  onChange,
  onClear,
}) => {
  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    filters.categoryId ||
    filters.type ||
    filters.search;

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <div className="filter-group">
          <label className="form-label">From</label>
          <input
            type="date"
            className="form-input form-input-sm"
            value={filters.dateFrom || ''}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value, page: 1 })}
          />
        </div>
        <div className="filter-group">
          <label className="form-label">To</label>
          <input
            type="date"
            className="form-input form-input-sm"
            value={filters.dateTo || ''}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value, page: 1 })}
          />
        </div>
        <div className="filter-group">
          <label className="form-label">Category</label>
          <select
            className="form-input form-input-sm"
            value={filters.categoryId || ''}
            onChange={(e) =>
              onChange({ ...filters, categoryId: e.target.value, page: 1 })
            }
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="form-label">Type</label>
          <select
            className="form-input form-input-sm"
            value={filters.type || ''}
            onChange={(e) =>
              onChange({
                ...filters,
                type: e.target.value as TransactionFilters['type'],
                page: 1,
              })
            }
          >
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
        <div className="filter-group filter-search">
          <label className="form-label">Search</label>
          <input
            type="text"
            className="form-input form-input-sm"
            placeholder="Search description..."
            value={filters.search || ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value, page: 1 })}
          />
        </div>
        {hasActiveFilters && (
          <div className="filter-group filter-action">
            <label className="form-label">&nbsp;</label>
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionFilter;
