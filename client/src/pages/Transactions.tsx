import React, { useState } from 'react';
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from '../hooks/useTransactions';
import { useCategories } from '../hooks/useCategories';
import TransactionList from '../components/transactions/TransactionList';
import TransactionFilter from '../components/transactions/TransactionFilter';
import TransactionForm from '../components/transactions/TransactionForm';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import type { Transaction, TransactionFilters } from '../types';

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
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

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
        <h1 className="page-title">Transactions</h1>
        <Button variant="primary" onClick={handleAdd}>
          + Add Transaction
        </Button>
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
