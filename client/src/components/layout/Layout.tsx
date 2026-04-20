import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout: React.FC = () => {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <div className="app-content">
          <div className="app-content-shell">
          <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
