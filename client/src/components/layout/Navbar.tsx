import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import apiClient from '../../api/client';
import AppIcon from '../ui/AppIcon';

interface NavbarProps {
  onMenuToggle: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuToggle }) => {
  const { user, clearAuth } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    try { await apiClient.delete('/api/auth/logout'); } catch {}
    clearAuth();
    navigate('/login');
  };

  const initial = user?.email?.charAt(0).toUpperCase() ?? 'U';
  const displayName = user?.email?.split('@')[0] ?? 'User';

  return (
    <nav className="fixed top-0 left-0 right-0 z-30 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-3">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={onMenuToggle}
        className="sm:hidden flex items-center justify-center w-10 h-10 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Toggle menu"
      >
        <AppIcon name="menu" size={20} />
      </button>

      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-700 flex items-center justify-center text-white flex-shrink-0">
          <AppIcon name="trend" size={14} />
        </span>
        <span className="font-bold text-slate-900 dark:text-slate-100 text-[15px] hidden sm:block">
          FinanceTracker
        </span>
      </Link>

      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1" ref={rootRef}>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setNotifOpen(v => !v); setUserMenuOpen(false); }}
            className="relative flex items-center justify-center w-10 h-10 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Notifications"
          >
            <span className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100 text-sm">
                Notifications
              </div>
              <div className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                No new notifications
              </div>
              <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700">
                <button className="w-full text-center text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 py-1 flex items-center justify-center gap-1">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  View all
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          <AppIcon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setUserMenuOpen(v => !v); setNotifOpen(false); }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="User menu"
          >
            <span className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {initial}
            </span>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{displayName}</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[130px] truncate">{user?.email}</div>
            </div>
            <svg className="hidden sm:block text-slate-400 dark:text-slate-500 ml-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden py-1">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <span className="w-9 h-9 rounded-full bg-slate-900 dark:bg-slate-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {initial}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{displayName}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{user?.email}</div>
                </div>
              </div>
              <Link
                to="/settings"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <AppIcon name="settings" size={15} />
                Settings
              </Link>
              <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full text-left transition-colors"
                >
                  <AppIcon name="logout" size={15} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
