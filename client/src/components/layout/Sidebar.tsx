import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../api/client';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/transactions', label: 'Transactions', icon: '💳' },
  { path: '/import', label: 'Import', icon: '📥' },
  { path: '/budgets', label: 'Budgets', icon: '💰' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

const Sidebar: React.FC = () => {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

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
        onClick={() => setCollapsed((c) => !c)}
        aria-label="Toggle sidebar"
      >
        {collapsed ? '☰' : '✕'}
      </button>
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="sidebar-logo-icon">💹</span>
            {!collapsed && <span className="sidebar-logo-text">FinanceTracker</span>}
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
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && user && (
            <div className="sidebar-user">
              <span className="sidebar-user-avatar">
                {user.email.charAt(0).toUpperCase()}
              </span>
              <span className="sidebar-user-email" title={user.email}>
                {user.email}
              </span>
            </div>
          )}
          <button
            className="sidebar-logout"
            onClick={handleLogout}
            title="Logout"
          >
            <span>🚪</span>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
