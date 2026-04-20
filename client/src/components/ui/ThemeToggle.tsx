import React, { useEffect } from 'react';
import { useThemeStore } from '../../store/themeStore';
import AppIcon from './AppIcon';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <AppIcon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
    </button>
  );
};

export default ThemeToggle;
