import React, { useState } from 'react';
import {
  useBudgets,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
} from '../hooks/useBudgets';
import { useCategories } from '../hooks/useCategories';
import BudgetCard from '../components/budgets/BudgetCard';
import BudgetForm from '../components/budgets/BudgetForm';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../components/ui/Toast';
import type { Budget } from '../types';

const getMonthString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const formatMonthLabel = (monthStr: string) => {
  const [y, m] = monthStr.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
};

const Budgets: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const month = getMonthString(currentDate);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const { data: budgets = [], isLoading } = useBudgets(month);
  const { data: categories = [] } = useCategories();
  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const deleteMutation = useDeleteBudget();

  const isCurrentMonth = getMonthString(currentDate) === getMonthString(new Date());

  const prevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const nextMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const handleAdd = () => {
    setEditingBudget(null);
    setModalOpen(true);
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      showSuccess('Budget deleted.');
    } catch {
      showError('Failed to delete budget.');
    }
  };

  const handleSubmit = async (formData: Partial<Budget>) => {
    try {
      if (editingBudget) {
        await updateMutation.mutateAsync({ id: editingBudget.id, ...formData });
        showSuccess('Budget updated.');
      } else {
        await createMutation.mutateAsync(formData);
        showSuccess('Budget created.');
      }
      setModalOpen(false);
      setEditingBudget(null);
    } catch {
      showError('Failed to save budget.');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Budgets</h1>
        <div className="page-header-right">
          <div className="month-selector">
            <button className="month-nav-btn" onClick={prevMonth} aria-label="Previous month">
              &larr;
            </button>
            <span className="month-label">{formatMonthLabel(month)}</span>
            <button
              className="month-nav-btn"
              onClick={nextMonth}
              disabled={isCurrentMonth}
              aria-label="Next month"
            >
              &rarr;
            </button>
          </div>
          <Button variant="primary" onClick={handleAdd}>
            + Add Budget
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner centered />
      ) : budgets.length === 0 ? (
        <EmptyState
          icon="💰"
          title="No budgets set"
          description="Create budget limits for your categories to track your spending."
          actionLabel="Add Budget"
          onAction={handleAdd}
        />
      ) : (
        <div className="budgets-grid">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingBudget(null);
        }}
        title={editingBudget ? 'Edit Budget' : 'New Budget'}
        size="sm"
      >
        <BudgetForm
          initialData={editingBudget ?? undefined}
          categories={categories}
          defaultMonth={month}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false);
            setEditingBudget(null);
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>
    </div>
  );
};

export default Budgets;
