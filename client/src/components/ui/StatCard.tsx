import React from 'react';
import AppIcon from './AppIcon';

interface StatCardProps {
  label: string;
  value: string;
  icon: 'wallet' | 'trend' | 'spark';
  tone?: 'default' | 'success' | 'danger' | 'accent';
  hint?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  tone = 'default',
  hint,
}) => {
  return (
    <div className={`stat-card stat-card-${tone}`}>
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        <span className="stat-card-icon">
          <AppIcon name={icon} size={18} />
        </span>
      </div>
      <div className="stat-card-value">{value}</div>
      {hint ? <p className="stat-card-hint">{hint}</p> : null}
    </div>
  );
};

export default StatCard;
