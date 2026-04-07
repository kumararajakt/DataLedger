import React, { useState, useEffect } from 'react';
import type { Transaction, Category } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface TransactionFormProps {
  initialData?: Partial<Transaction>;
  categories: Category[];
  onSubmit: (data: Partial<Transaction>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const TransactionForm: React.FC<TransactionFormProps> = ({
  initialData,
  categories,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [form, setForm] = useState({
    date: initialData?.date ? initialData.date.substring(0, 10) : new Date().toISOString().substring(0, 10),
    description: initialData?.description ?? '',
    amount: initialData?.amount ? String(Math.abs(initialData.amount)) : '',
    type: initialData?.type ?? 'expense',
    categoryId: initialData?.categoryId ?? '',
    notes: initialData?.notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setForm({
        date: initialData.date ? initialData.date.substring(0, 10) : new Date().toISOString().substring(0, 10),
        description: initialData.description ?? '',
        amount: initialData.amount ? String(Math.abs(initialData.amount)) : '',
        type: initialData.type ?? 'expense',
        categoryId: initialData.categoryId ?? '',
        notes: initialData.notes ?? '',
      });
    }
  }, [initialData]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.date) errs.date = 'Date is required';
    if (!form.description.trim()) errs.description = 'Description is required';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      errs.amount = 'Enter a valid positive amount';
    }
    if (!form.type) errs.type = 'Type is required';
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
      date: form.date,
      description: form.description.trim(),
      amount: Number(form.amount),
      type: form.type as Transaction['type'],
      categoryId: form.categoryId || null,
      notes: form.notes.trim() || null,
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
      <Input
        label="Date"
        type="date"
        value={form.date}
        onChange={(e) => handleChange('date', e.target.value)}
        error={errors.date}
        required
      />
      <Input
        label="Description"
        type="text"
        value={form.description}
        onChange={(e) => handleChange('description', e.target.value)}
        error={errors.description}
        placeholder="Enter description"
        required
      />
      <Input
        label="Amount (₹)"
        type="number"
        min="0"
        step="0.01"
        value={form.amount}
        onChange={(e) => handleChange('amount', e.target.value)}
        error={errors.amount}
        placeholder="0.00"
        required
      />
      <div className="form-group">
        <label className="form-label" htmlFor="type">
          Type
        </label>
        <select
          id="type"
          className="form-input"
          value={form.type}
          onChange={(e) => handleChange('type', e.target.value)}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="transfer">Transfer</option>
        </select>
        {errors.type && <span className="form-error">{errors.type}</span>}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="categoryId">
          Category
        </label>
        <select
          id="categoryId"
          className="form-input"
          value={form.categoryId}
          onChange={(e) => handleChange('categoryId', e.target.value)}
        >
          <option value="">— Uncategorized —</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="notes">Notes (optional)</label>
        <textarea
          id="notes"
          className="form-input"
          rows={2}
          value={form.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Add a note about this transaction..."
          style={{ resize: 'vertical' }}
        />
      </div>
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={isLoading}>
          {initialData?.id ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
};

export default TransactionForm;
