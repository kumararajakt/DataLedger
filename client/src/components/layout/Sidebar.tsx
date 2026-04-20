import React from 'react';
import { NavLink } from 'react-router-dom';
import AppIcon from '../ui/AppIcon';

const mainItems = [
  { path: '/',             label: 'Dashboard',    icon: 'dashboard'    as const },
  { path: '/transactions', label: 'Transactions', icon: 'transactions' as const },
  { path: '/investments',  label: 'Investments',  icon: 'investments'  as const },
  { path: '/import',       label: 'Import',       icon: 'import'       as const },
  { path: '/budgets',      label: 'Budgets',      icon: 'budgets'      as const },
];

const bottomItems = [
  { path: '/settings', label: 'Settings', icon: 'settings' as const },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
  }`;

const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 sm:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          'fixed top-16 bottom-0 left-0 z-20',
          'w-60 flex flex-col overflow-hidden',
          'bg-white border-r border-slate-200',
          'dark:bg-slate-900 dark:border-slate-700',
          'transition-transform duration-200 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full sm:translate-x-0',
        ].join(' ')}
      >
        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto px-2 pt-4 pb-2">
          <ul className="space-y-0.5">
            {mainItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={onClose}
                  className={navLinkClass}
                >
                  <AppIcon name={item.icon} size={17} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom nav */}
        <nav className="px-2 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <ul className="space-y-0.5">
            {bottomItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={navLinkClass}
                >
                  <AppIcon name={item.icon} size={17} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
