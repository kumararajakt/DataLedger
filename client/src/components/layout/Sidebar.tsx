import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../api/client';
import ThemeToggle from '../ui/ThemeToggle';
import AppIcon from '../ui/AppIcon';

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'dashboard' as const },
  { path: '/transactions', label: 'Transactions', icon: 'transactions' as const },
  { path: '/investments', label: 'Investments', icon: 'investments' as const },
  { path: '/import', label: 'Import', icon: 'import' as const },
  { path: '/budgets', label: 'Budgets', icon: 'budgets' as const },
  { path: '/settings', label: 'Settings', icon: 'settings' as const },
];

const Sidebar: React.FC = () => {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await apiClient.delete('/api/auth/logout');
    } catch {
      // ignore logout errors
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close navigation' : 'Open navigation'}
      >
        <AppIcon name={open ? 'close' : 'menu'} />
      </button>
      <div
        className={`sidebar-backdrop ${open ? 'sidebar-backdrop-visible' : ''}`}
        onClick={() => setOpen(false)}
      />
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="sidebar-logo-mark">
              <AppIcon name="trend" size={18} />
            </span>
            <div>
              <span className="sidebar-logo-eyebrow">Personal wealth OS</span>
              <span className="sidebar-logo-text">FinanceTracker</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? 'sidebar-nav-item-active' : ''}`
              }
              onClick={() => setOpen(false)}
            >
              <span className="sidebar-nav-icon">
                <AppIcon name={item.icon} size={18} />
              </span>
              <span className="sidebar-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="sidebar-user">
              <span className="sidebar-user-avatar">
                {user.email.charAt(0).toUpperCase()}
              </span>
              <div className="sidebar-user-copy">
                <span className="sidebar-user-label">Signed in</span>
                <span className="sidebar-user-email" title={user.email}>
                  {user.email}
                </span>
              </div>
            </div>
          )}
          <div className="sidebar-actions">
            <ThemeToggle />
          </div>
          <button
            className="sidebar-logout"
            onClick={handleLogout}
            title="Logout"
          >
            <AppIcon name="logout" size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
