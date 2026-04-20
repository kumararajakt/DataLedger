import React, { useMemo, useState } from 'react';
import { useCategories } from '../hooks/useCategories';
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from '../hooks/useTransactions';
import type { Transaction, InstrumentType } from '../types';
import Modal from '../components/ui/Modal';
import TransactionForm from '../components/transactions/TransactionForm';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatCard from '../components/ui/StatCard';
import AppIcon from '../components/ui/AppIcon';

const INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  mutual_fund: 'Mutual Fund',
  sip: 'SIP',
  stock: 'Stock',
  fd: 'Fixed Deposit',
  ppf: 'PPF',
  nps: 'NPS',
  bond: 'Bond',
  gold: 'Gold',
  silver: 'Silver',
};

const fmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const Investments: React.FC = () => {
  const { data: categories = [] } = useCategories();
  const investmentsCategoryId = categories.find((c) => c.name === 'Investments')?.id;
  const { data: txData, isLoading } = useTransactions(
    investmentsCategoryId ? { categoryId: investmentsCategoryId, limit: 500, page: 1 } : {},
    Boolean(investmentsCategoryId)
  );
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [filterType, setFilterType] = useState<InstrumentType | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const allTx = txData?.data ?? [];

  const filtered = useMemo(() => {
    return allTx.filter((tx) => {
      if (filterType && tx.investmentDetails?.instrument_type !== filterType) return false;
      if (dateFrom && tx.date < dateFrom) return false;
      if (dateTo && tx.date > dateTo) return false;
      return true;
    });
  }, [allTx, filterType, dateFrom, dateTo]);

  const totalInvested = allTx.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const thisMonth = new Date().toISOString().substring(0, 7);
  const thisMonthTotal = allTx
    .filter((tx) => tx.date.startsWith(thisMonth))
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const allocation = useMemo(() => {
    const grouped = allTx.reduce<Record<string, number>>((acc, tx) => {
      const key = tx.investmentDetails?.instrument_type ?? 'unknown';
      acc[key] = (acc[key] ?? 0) + Math.abs(tx.amount);
      return acc;
    }, {});
    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [allTx]);

  const handleAdd = () => {
    setEditingTx(null);
    setModalOpen(true);
  };

  const handleEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this investment transaction?')) return;
    await deleteMutation.mutateAsync(id);
  };

  const handleSubmit = async (data: Partial<Transaction>) => {
    if (editingTx) {
      await updateMutation.mutateAsync({ id: editingTx.id, ...data });
    } else {
      await createMutation.mutateAsync({
        ...data,
        categoryId: investmentsCategoryId ?? null,
        source: 'manual',
      });
    }
    setModalOpen(false);
    setEditingTx(null);
  };

  const initialFormData = useMemo(() => {
    if (editingTx) return editingTx;
    return investmentsCategoryId ? { categoryId: investmentsCategoryId } : undefined;
  }, [editingTx, investmentsCategoryId]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Portfolio activity</p>
          <h1 className="page-title">Investments</h1>
          <p className="page-description">
            Review recurring contributions, instrument mix, and recorded buy activity.
          </p>
        </div>
        <Button className="btn-with-icon" variant="primary" onClick={handleAdd}>
          <AppIcon name="trend" size={16} />
          Add investment
        </Button>
      </div>

      <section className="hero-panel hero-panel-compact">
        <div className="hero-copy">
          <span className="hero-kicker">Portfolio view</span>
          <h2>Investment ledger, cleaned up</h2>
          <p>
            This page uses your investment-tagged transactions as the source of truth for
            contribution tracking and instrument-level review.
          </p>
        </div>
        <div className="hero-metrics">
          <div className="hero-metric">
            <span>Tracked instruments</span>
            <strong>{allocation.length}</strong>
          </div>
          <div className="hero-metric">
            <span>This month</span>
            <strong>{fmt(thisMonthTotal)}</strong>
          </div>
          <div className="hero-metric">
            <span>Transactions</span>
            <strong>{allTx.length}</strong>
          </div>
        </div>
      </section>

      <div className="summary-grid">
        <StatCard label="Total invested" value={fmt(totalInvested)} icon="trend" tone="accent" />
        <StatCard label="This month" value={fmt(thisMonthTotal)} icon="spark" tone="default" />
        <StatCard
          label="Most active instrument"
          value={allocation[0] ? INSTRUMENT_LABELS[allocation[0][0] as InstrumentType] ?? 'Other' : 'No data'}
          icon="wallet"
          tone="default"
        />
      </div>

      <div className="dashboard-secondary-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <p className="card-eyebrow">Allocation</p>
              <h2 className="card-title">Instrument mix</h2>
            </div>
          </div>
          {allocation.length ? (
            <div className="allocation-list">
              {allocation.map(([type, amount]) => {
                const pct = totalInvested > 0 ? (amount / totalInvested) * 100 : 0;
                return (
                  <div key={type} className="allocation-item">
                    <div className="allocation-copy">
                      <strong>{INSTRUMENT_LABELS[type as InstrumentType] ?? 'Other'}</strong>
                      <span>{fmt(amount)}</span>
                    </div>
                    <div className="allocation-bar">
                      <div className="allocation-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="allocation-pct">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<AppIcon name="trend" size={20} />}
              title="No investment activity"
              description="Add your first investment transaction to see allocation insights."
              actionLabel="Add Investment"
              onAction={handleAdd}
            />
          )}
        </div>

        <div className="card filter-panel">
          <div className="card-header">
            <div>
              <p className="card-eyebrow">Filter</p>
              <h2 className="card-title">Narrow the ledger</h2>
            </div>
          </div>
          <div className="filter-grid">
            <div className="filter-group">
              <label className="form-label">Instrument type</label>
              <select
                className="form-input"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as InstrumentType | '')}
              >
                <option value="">All types</option>
                {(Object.keys(INSTRUMENT_LABELS) as InstrumentType[]).map((t) => (
                  <option key={t} value={t}>
                    {INSTRUMENT_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label className="form-label">From</label>
              <input
                type="date"
                className="form-input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label className="form-label">To</label>
              <input
                type="date"
                className="form-input"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label className="form-label">Reset</label>
              <Button
                variant="ghost"
                onClick={() => {
                  setFilterType('');
                  setDateFrom('');
                  setDateTo('');
                }}
                disabled={!filterType && !dateFrom && !dateTo}
              >
                Clear filters
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <p className="card-eyebrow">Ledger</p>
            <h2 className="card-title">Investment transactions</h2>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner centered />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<AppIcon name="trend" size={20} />}
            title={allTx.length === 0 ? 'No investment transactions yet' : 'No matching transactions'}
            description={
              allTx.length === 0
                ? 'Create your first investment transaction to start tracking contributions.'
                : 'Try broadening the filters to see more results.'
            }
            actionLabel={allTx.length === 0 ? 'Add Investment' : undefined}
            onAction={allTx.length === 0 ? handleAdd : undefined}
          />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Instrument</th>
                  <th>Type</th>
                  <th>Platform</th>
                  <th>Qty / Units</th>
                  <th>Price / NAV</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const inv = tx.investmentDetails;
                  return (
                    <tr key={tx.id}>
                      <td className="td-date">
                        {new Date(tx.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="td-desc">
                        <div>{inv?.instrument_name || tx.description}</div>
                        {tx.notes ? <div className="td-note">{tx.notes}</div> : null}
                      </td>
                      <td>
                        <span className="badge badge-info">
                          {inv?.instrument_type ? INSTRUMENT_LABELS[inv.instrument_type] : 'Not set'}
                        </span>
                      </td>
                      <td>{inv?.platform ?? '—'}</td>
                      <td>
                        {inv?.units != null
                          ? inv.units.toLocaleString('en-IN', { maximumFractionDigits: 3 })
                          : inv?.quantity != null
                          ? inv.quantity.toLocaleString('en-IN')
                          : '—'}
                      </td>
                      <td>
                        {inv?.nav_or_price != null ? fmt(inv.nav_or_price) : '—'}
                      </td>
                      <td className="td-amount amount-transfer">{fmt(tx.amount)}</td>
                      <td className="td-actions">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(tx)}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(tx.id)}>
                          Delete
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTx(null);
        }}
        title={editingTx ? 'Edit Investment' : 'New Investment'}
        size="md"
      >
        <TransactionForm
          initialData={initialFormData}
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

export default Investments;
