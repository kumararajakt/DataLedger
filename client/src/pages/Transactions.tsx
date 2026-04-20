import React, { useState } from 'react';
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useAutoClassify,
} from '../hooks/useTransactions';
import { useCategories } from '../hooks/useCategories';
import { useAiSettings } from '../hooks/useAiSettings';
import TransactionList from '../components/transactions/TransactionList';
import TransactionFilter from '../components/transactions/TransactionFilter';
import TransactionForm from '../components/transactions/TransactionForm';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import type { Transaction, TransactionFilters } from '../types';
import StatCard from '../components/ui/StatCard';
import AppIcon from '../components/ui/AppIcon';

const DEFAULT_FILTERS: TransactionFilters = {
  page: 1,
  limit: 20,
};

const Transactions: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const { data, isLoading } = useTransactions(filters);
  const { data: categories = [] } = useCategories();
  const { data: aiSettings } = useAiSettings();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();
  const autoClassifyMutation = useAutoClassify();

  const aiEnabled = aiSettings?.enabled === true;
  const transactions = data?.data ?? [];
  const expenseTotal = transactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const incomeTotal = transactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const uncategorizedCount = transactions.filter((tx) => !tx.categoryId).length;

  const handleAutoClassify = async () => {
    try {
      const result = await autoClassifyMutation.mutateAsync();
      if (result.classified === 0) {
        showSuccess('No uncategorized transactions to classify.');
      } else {
        showSuccess(`Classified ${result.classified} of ${result.total} transactions.`);
      }
    } catch {
      showError('Auto-classify failed. Check your AI settings.');
    }
  };

  const handleAdd = () => {
    setEditingTx(null);
    setModalOpen(true);
  };

  const handleEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      showSuccess('Transaction deleted.');
    } catch {
      showError('Failed to delete transaction.');
    }
  };

  const handleSubmit = async (formData: Partial<Transaction>) => {
    try {
      if (editingTx) {
        await updateMutation.mutateAsync({ id: editingTx.id, ...formData });
        showSuccess('Transaction updated.');
      } else {
        await createMutation.mutateAsync({ ...formData, source: 'manual' });
        showSuccess('Transaction created.');
      }
      setModalOpen(false);
      setEditingTx(null);
    } catch {
      showError('Failed to save transaction.');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Cash flow ledger</p>
          <h1 className="page-title">Transactions</h1>
          <p className="page-description">
            Search, filter, and maintain the transaction stream that powers reports and budgets.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {aiEnabled && (
            <Button
              className="btn-with-icon"
              variant="secondary"
              onClick={handleAutoClassify}
              disabled={autoClassifyMutation.isPending}
            >
              <AppIcon name="wand" size={16} />
              {autoClassifyMutation.isPending ? 'Classifying…' : 'Auto Classify'}
            </Button>
          )}
          <Button className="btn-with-icon" variant="primary" onClick={handleAdd}>
            <AppIcon name="transactions" size={16} />
            Add transaction
          </Button>
        </div>
      </div>

      <div className="summary-grid">
        <StatCard label="Visible transactions" value={String(data?.total ?? 0)} icon="wallet" />
        <StatCard label="Income on page" value={`₹${incomeTotal.toLocaleString('en-IN')}`} icon="trend" tone="success" />
        <StatCard label="Expense on page" value={`₹${expenseTotal.toLocaleString('en-IN')}`} icon="wallet" tone="danger" />
        <StatCard label="Uncategorized" value={String(uncategorizedCount)} icon="spark" tone="accent" />
      </div>

      <TransactionFilter
        filters={filters}
        categories={categories}
        onChange={(f) => setFilters(f)}
        onClear={() => setFilters(DEFAULT_FILTERS)}
      />

      <div className="card">
        <TransactionList
          transactions={data?.data ?? []}
          total={data?.total ?? 0}
          page={filters.page ?? 1}
          limit={filters.limit ?? 20}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          onAddNew={handleAdd}
        />
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTx(null);
        }}
        title={editingTx ? 'Edit Transaction' : 'New Transaction'}
        size="md"
      >
        <TransactionForm
          initialData={editingTx ?? undefined}
          categories={categories}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false);
            setEditingTx(null);
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>
    </div>
  );
};

export default Transactions;
