import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
  centered?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  inline = false,
  centered = false,
}) => {
  const spinner = <span className={`spinner spinner-${size}`} aria-label="Loading" />;

  if (inline) {
    return spinner;
  }

  if (centered) {
    return <div className="spinner-centered">{spinner}</div>;
  }

  return spinner;
};

export default LoadingSpinner;
