import React, { useState, useEffect } from 'react';
import type { Transaction, Category, InvestmentDetails, InstrumentType } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface TransactionFormProps {
  initialData?: Partial<Transaction>;
  categories: Category[];
  onSubmit: (data: Partial<Transaction>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

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

const emptyInvestment = (): Partial<InvestmentDetails> => ({ instrument_type: undefined as unknown as InstrumentType });

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
  const [investmentDetails, setInvestmentDetails] = useState<Partial<InvestmentDetails>>(
    initialData?.investmentDetails ?? emptyInvestment()
  );
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
      setInvestmentDetails(initialData.investmentDetails ?? emptyInvestment());
    }
  }, [initialData]);

  const selectedCategory = categories.find((c) => c.id === form.categoryId);
  const showInvestmentDetails = selectedCategory?.name === 'Investments';
  const instrType = investmentDetails.instrument_type;

  const showUnits = instrType && ['mutual_fund', 'sip', 'bond', 'gold', 'silver'].includes(instrType);
  const showQuantity = instrType === 'stock';
  const showNavOrPrice = instrType && ['mutual_fund', 'sip', 'stock', 'bond', 'gold', 'silver'].includes(instrType);
  const showFolio = instrType && ['mutual_fund', 'sip'].includes(instrType);
  const showInterestRate = instrType && ['fd', 'bond'].includes(instrType);
  const showMaturityDate = instrType && ['fd', 'ppf', 'nps', 'bond'].includes(instrType);

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

    let resolvedInvestmentDetails: InvestmentDetails | null = null;
    if (showInvestmentDetails && investmentDetails.instrument_type) {
      resolvedInvestmentDetails = {
        instrument_type: investmentDetails.instrument_type,
        ...(investmentDetails.instrument_name ? { instrument_name: investmentDetails.instrument_name } : {}),
        ...(investmentDetails.units != null ? { units: investmentDetails.units } : {}),
        ...(investmentDetails.quantity != null ? { quantity: investmentDetails.quantity } : {}),
        ...(investmentDetails.nav_or_price != null ? { nav_or_price: investmentDetails.nav_or_price } : {}),
        ...(investmentDetails.folio_number ? { folio_number: investmentDetails.folio_number } : {}),
        ...(investmentDetails.platform ? { platform: investmentDetails.platform } : {}),
        ...(investmentDetails.interest_rate != null ? { interest_rate: investmentDetails.interest_rate } : {}),
        ...(investmentDetails.maturity_date ? { maturity_date: investmentDetails.maturity_date } : {}),
      };
    }

    await onSubmit({
      ...initialData,
      date: form.date,
      description: form.description.trim(),
      amount: Number(form.amount),
      type: form.type as Transaction['type'],
      categoryId: form.categoryId || null,
      notes: form.notes.trim() || null,
      investmentDetails: resolvedInvestmentDetails,
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

  const handleInvChange = (field: keyof InvestmentDetails, value: string) => {
    setInvestmentDetails((prev) => ({
      ...prev,
      [field]: value === '' ? undefined : (
        ['units', 'quantity', 'nav_or_price', 'interest_rate'].includes(field)
          ? Number(value)
          : value
      ),
    }));
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

      {showInvestmentDetails && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
          <p className="form-label" style={{ marginBottom: '0.75rem', color: 'var(--color-primary, #059669)', fontWeight: 600 }}>
            📈 Investment Details
          </p>
          <div className="form-group">
            <label className="form-label" htmlFor="instrument_type">Instrument Type</label>
            <select
              id="instrument_type"
              className="form-input"
              value={investmentDetails.instrument_type ?? ''}
              onChange={(e) => handleInvChange('instrument_type', e.target.value)}
            >
              <option value="">— Select type —</option>
              {(Object.keys(INSTRUMENT_LABELS) as InstrumentType[]).map((t) => (
                <option key={t} value={t}>{INSTRUMENT_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {instrType && (
            <>
              <Input
                label="Instrument / Fund Name"
                type="text"
                value={investmentDetails.instrument_name ?? ''}
                onChange={(e) => handleInvChange('instrument_name', e.target.value)}
                placeholder={instrType === 'stock' ? 'e.g. RELIANCE, INFY' : instrType === 'fd' ? 'e.g. SBI Fixed Deposit' : 'e.g. HDFC Mid Cap Fund'}
              />
              {showUnits && (
                <Input
                  label={instrType === 'gold' || instrType === 'silver' ? 'Quantity (grams)' : 'Units'}
                  type="number"
                  min="0"
                  step="0.001"
                  value={investmentDetails.units != null ? String(investmentDetails.units) : ''}
                  onChange={(e) => handleInvChange('units', e.target.value)}
                  placeholder="0.000"
                />
              )}
              {showQuantity && (
                <Input
                  label="Shares / Quantity"
                  type="number"
                  min="0"
                  step="1"
                  value={investmentDetails.quantity != null ? String(investmentDetails.quantity) : ''}
                  onChange={(e) => handleInvChange('quantity', e.target.value)}
                  placeholder="0"
                />
              )}
              {showNavOrPrice && (
                <Input
                  label={instrType === 'stock' ? 'Buy Price (₹/share)' : 'NAV / Price (₹)'}
                  type="number"
                  min="0"
                  step="0.01"
                  value={investmentDetails.nav_or_price != null ? String(investmentDetails.nav_or_price) : ''}
                  onChange={(e) => handleInvChange('nav_or_price', e.target.value)}
                  placeholder="0.00"
                />
              )}
              {showFolio && (
                <Input
                  label="Folio Number"
                  type="text"
                  value={investmentDetails.folio_number ?? ''}
                  onChange={(e) => handleInvChange('folio_number', e.target.value)}
                  placeholder="e.g. 1234567"
                />
              )}
              {showInterestRate && (
                <Input
                  label="Interest Rate (% p.a.)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={investmentDetails.interest_rate != null ? String(investmentDetails.interest_rate) : ''}
                  onChange={(e) => handleInvChange('interest_rate', e.target.value)}
                  placeholder="e.g. 7.5"
                />
              )}
              {showMaturityDate && (
                <Input
                  label="Maturity Date"
                  type="date"
                  value={investmentDetails.maturity_date ?? ''}
                  onChange={(e) => handleInvChange('maturity_date', e.target.value)}
                />
              )}
              <Input
                label="Platform"
                type="text"
                value={investmentDetails.platform ?? ''}
                onChange={(e) => handleInvChange('platform', e.target.value)}
                placeholder="e.g. Zerodha, Groww, SBI, HDFC"
              />
            </>
          )}
        </div>
      )}

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
