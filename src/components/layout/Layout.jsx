import { useState, useCallback, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar, { EXPANDED_WIDTH, COLLAPSED_WIDTH } from './Sidebar';
import Header from './Header';
import LiveOpsTicker from './LiveOpsTicker';
import AddLeadModal from '../crm/AddLeadModal';
import './Layout.css';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isMobile;
}

export default function Layout() {
  const isMobile = useIsMobile();

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (window.innerWidth < 768) return 0;
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true'
        ? COLLAPSED_WIDTH
        : EXPANDED_WIDTH;
    } catch {
      return EXPANDED_WIDTH;
    }
  });

  const [showAddLead, setShowAddLead] = useState(false);

  const handleWidthChange = useCallback((width) => {
    setSidebarWidth(width);
  }, []);

  const effectiveMargin = isMobile ? 0 : sidebarWidth;

  return (
    <div className="layout">
      <Sidebar onWidthChange={handleWidthChange} />
      <Header
        sidebarWidth={effectiveMargin}
        onAddLead={() => setShowAddLead(true)}
        isMobile={isMobile}
      />
      <main
        className="layout-main"
        style={{
          marginLeft: effectiveMargin,
          paddingTop: 'var(--header-height)',
          paddingBottom: 40,
        }}
      >
        <div className="layout-content">
          <Outlet />
        </div>
      </main>
      <LiveOpsTicker />
      {showAddLead && <AddLeadModal onClose={() => setShowAddLead(false)} />}
    </div>
  );
}
