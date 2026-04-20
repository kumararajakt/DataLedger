import React from 'react';

interface AppIconProps {
  name:
    | 'dashboard'
    | 'transactions'
    | 'investments'
    | 'import'
    | 'budgets'
    | 'settings'
    | 'sun'
    | 'moon'
    | 'menu'
    | 'close'
    | 'logout'
    | 'spark'
    | 'wallet'
    | 'trend'
    | 'shield'
  | 'wand';
  size?: number;
  className?: string;
}

const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const AppIcon: React.FC<AppIconProps> = ({ name, size = 20, className }) => {
  const icons: Record<AppIconProps['name'], React.ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="5" rx="2" />
        <rect x="13" y="10" width="8" height="11" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
      </>
    ),
    transactions: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h10" />
        <path d="M4 17h7" />
        <path d="M17 10l3 2-3 2" />
        <path d="M14 17l3 2 3-2" />
      </>
    ),
    investments: (
      <>
        <path d="M4 18l5-5 4 3 7-8" />
        <path d="M15 8h5v5" />
      </>
    ),
    import: (
      <>
        <path d="M12 3v11" />
        <path d="M8 10l4 4 4-4" />
        <path d="M4 19h16" />
      </>
    ),
    budgets: (
      <>
        <path d="M4 7h16" />
        <path d="M6 4v6" />
        <path d="M18 4v6" />
        <rect x="4" y="7" width="16" height="13" rx="3" />
        <path d="M8 13h8" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V22a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 20.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.4a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.96 4.05 1.7 1.7 0 0 0 10 2.5V2a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.04 3.65a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 8.4c.67.2 1.12.81 1.12 1.51a1.7 1.7 0 0 0 1.48 1.09H22a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2.5" />
        <path d="M12 19.5V22" />
        <path d="M4.93 4.93l1.77 1.77" />
        <path d="M17.3 17.3l1.77 1.77" />
        <path d="M2 12h2.5" />
        <path d="M19.5 12H22" />
        <path d="M4.93 19.07l1.77-1.77" />
        <path d="M17.3 6.7l1.77-1.77" />
      </>
    ),
    moon: <path d="M20 15.5A8.5 8.5 0 1 1 11.5 4a7 7 0 0 0 8.5 11.5Z" />,
    menu: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </>
    ),
    close: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6 6 18" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7Z" />
        <path d="m18.5 3 .7 1.8L21 5.5l-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5Z" />
        <path d="M4 8h16" />
        <path d="M16 13h2" />
      </>
    ),
    trend: (
      <>
        <path d="M3 17h18" />
        <path d="M6 14 10 10l3 3 5-6" />
        <path d="M15 7h3v3" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v5c0 5 3.4 8.4 7 10 3.6-1.6 7-5 7-10V6Z" />
        <path d="m9.5 12 1.7 1.7 3.3-3.7" />
      </>
    ),
    wand: (
      <>
        <path d="m15 4 1.5 1.5" />
        <path d="m18 2 1 1" />
        <path d="m14 7 1 1" />
        <path d="M3 21 12 12" />
        <path d="m12 12 2-2" />
        <path d="m9 7 2 2" />
        <path d="m7 9 2 2" />
        <path d="m5 11 2 2" />
        <path d="m19 5-6.5 6.5" />
        <path d="m21 3-2 2" />
      </>
    ),
  };

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...iconProps}
    >
      {icons[name]}
    </svg>
  );
};

export default AppIcon;
