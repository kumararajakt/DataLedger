import React, { useState, useEffect } from 'react';
import type { Budget, Category } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface BudgetFormProps {
  initialData?: Partial<Budget>;
  categories: Category[];
  defaultMonth?: string;
  onSubmit: (data: Partial<Budget>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const BudgetForm: React.FC<BudgetFormProps> = ({
  initialData,
  categories,
  defaultMonth,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const currentMonth = defaultMonth || new Date().toISOString().substring(0, 7);

  const [form, setForm] = useState({
    categoryId: initialData?.categoryId ?? '',
    month: initialData?.month ?? currentMonth,
    amount: initialData?.amount ? String(initialData.amount) : '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setForm({
        categoryId: initialData.categoryId ?? '',
        month: initialData.month ?? currentMonth,
        amount: initialData.amount ? String(initialData.amount) : '',
      });
    }
  }, [initialData, currentMonth]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.categoryId) errs.categoryId = 'Category is required';
    if (!form.month) errs.month = 'Month is required';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      errs.amount = 'Enter a valid positive amount';
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    await onSubmit({
      ...initialData,
      categoryId: form.categoryId,
      month: form.month,
      amount: Number(form.amount),
    });
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <div className="form-group">
        <label className="form-label" htmlFor="budget-category">
          Category
        </label>
        <select
          id="budget-category"
          className={`form-input ${errors.categoryId ? 'form-input-error' : ''}`}
          value={form.categoryId}
          onChange={(e) => handleChange('categoryId', e.target.value)}
          required
        >
          <option value="">Select a category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>
        {errors.categoryId && <span className="form-error">{errors.categoryId}</span>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="budget-month">
          Month
        </label>
        <input
          id="budget-month"
          type="month"
          className={`form-input ${errors.month ? 'form-input-error' : ''}`}
          value={form.month}
          onChange={(e) => handleChange('month', e.target.value)}
          required
        />
        {errors.month && <span className="form-error">{errors.month}</span>}
      </div>

      <Input
        label="Budget Amount (₹)"
        type="number"
        min="0"
        step="0.01"
        value={form.amount}
        onChange={(e) => handleChange('amount', e.target.value)}
        error={errors.amount}
        placeholder="0.00"
        required
      />

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={isLoading}>
          {initialData?.id ? 'Update' : 'Create'} Budget
        </Button>
      </div>
    </form>
  );
};

export default BudgetForm;
