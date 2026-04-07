import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMonthlyReport, useCategoryBreakdown, useTrends } from '../hooks/useReports';
import { useTransactions } from '../hooks/useTransactions';
import SpendingDonut from '../components/charts/SpendingDonut';
import MonthlyTrend from '../components/charts/MonthlyTrend';
import TransactionRow from '../components/transactions/TransactionRow';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const formatAmount = (amount: number) =>
  `₹${Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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

const SkeletonCard = () => (
  <div className="card skeleton-card">
    <div className="skeleton skeleton-text" />
    <div className="skeleton skeleton-value" />
  </div>
);

const Dashboard: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const month = getMonthString(currentDate);

  const { data: report, isLoading: reportLoading } = useMonthlyReport(month);
  const { data: breakdown, isLoading: breakdownLoading } = useCategoryBreakdown(month);
  const { data: trends, isLoading: trendsLoading } = useTrends(6);
  const { data: recentTx, isLoading: txLoading } = useTransactions({ limit: 10, page: 1 });

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

  const isCurrentMonth =
    getMonthString(currentDate) === getMonthString(new Date());

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
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
      </div>

      {/* Summary cards */}
      <div className="summary-grid">
        {reportLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <div className="card summary-card summary-income">
              <p className="summary-label">Total Income</p>
              <p className="summary-value text-success">
                {formatAmount(report?.totalIncome ?? 0)}
              </p>
            </div>
            <div className="card summary-card summary-expense">
              <p className="summary-label">Total Expense</p>
              <p className="summary-value text-danger">
                {formatAmount(report?.totalExpense ?? 0)}
              </p>
            </div>
            <div className="card summary-card summary-savings">
              <p className="summary-label">Net Savings</p>
              <p
                className={`summary-value ${
                  (report?.netSavings ?? 0) >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {(report?.netSavings ?? 0) < 0 ? '-' : ''}
                {formatAmount(report?.netSavings ?? 0)}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="dashboard-charts">
        <div className="card chart-card">
          <h2 className="card-title">Spending by Category</h2>
          {breakdownLoading ? (
            <LoadingSpinner centered />
          ) : (
            <SpendingDonut data={breakdown ?? []} />
          )}
        </div>
        <div className="card chart-card">
          <h2 className="card-title">6-Month Trend</h2>
          {trendsLoading ? (
            <LoadingSpinner centered />
          ) : (
            <MonthlyTrend data={trends ?? []} />
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Transactions</h2>
          <Link to="/transactions" className="card-link">
            View all &rarr;
          </Link>
        </div>
        {txLoading ? (
          <LoadingSpinner centered />
        ) : recentTx?.data.length ? (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentTx.data.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted text-center">No transactions yet.</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
