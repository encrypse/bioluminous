import { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import logoFull from '../../assets/logo.png';
import logoMark from '../../assets/favicon.png';
import {
  LayoutDashboard, Users, GitBranch, Calendar, Phone,
  CheckSquare, MessageSquare, BarChart2, UserCog,
  Settings, ChevronLeft, ChevronRight, Building2,
  Receipt, FlaskConical, FileArchive, Menu, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

export const EXPANDED_WIDTH = 240;
export const COLLAPSED_WIDTH = 60;
const STORAGE_KEY = 'sidebar_collapsed';

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    section: 'RECRUITMENT',
    items: [
      { label: 'Leads', icon: Users, path: '/leads' },
      { label: 'Pipeline', icon: GitBranch, path: '/pipeline' },
    ]
  },
  {
    section: 'WORKFLOW',
    items: [
      { label: 'Bookings', icon: Calendar, path: '/bookings' },
      { label: 'Calls', icon: Phone, path: '/calls' },
      { label: 'Tasks', icon: CheckSquare, path: '/tasks' },
      { label: 'Communications', icon: MessageSquare, path: '/communications' },
    ]
  },
  {
    section: 'RESEARCH',
    items: [
      { label: 'Studies', icon: FlaskConical, path: '/studies' },
      { label: 'Documents', icon: FileArchive, path: '/documents' },
    ]
  },
  {
    section: 'FINANCE',
    items: [
      { label: 'Billing', icon: Receipt, path: '/billing' },
    ]
  },
  {
    section: 'ADMINISTRATION',
    items: [
      { label: 'Reports', icon: BarChart2, path: '/reports' },
      { label: 'Staff', icon: UserCog, path: '/staff' },
      { label: 'Settings', icon: Settings, path: '/settings' },
    ]
  },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isMobile;
}

export default function Sidebar({ onWidthChange }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = useCallback(() => {
    if (isMobile) {
      setMobileOpen(v => !v);
    } else {
      setCollapsed(prev => {
        const next = !prev;
        try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
        return next;
      });
    }
  }, [isMobile]);

  useEffect(() => {
    if (onWidthChange) {
      onWidthChange(isMobile ? 0 : collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
    }
  }, [collapsed, isMobile, onWidthChange]);

  // Close mobile drawer on route change
  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [isMobile]);

  const isOpen = isMobile ? mobileOpen : true;
  const isCollapsed = !isMobile && collapsed;

  return (
    <>
      {/* Mobile hamburger — shown in header via Layout, but also as floating btn */}
      {isMobile && (
        <button
          className="sidebar-mobile-toggle"
          onClick={toggle}
          aria-label="Open menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}

      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {isMobile && mobileOpen && (
          <motion.div
            className="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={`sidebar${isCollapsed ? ' collapsed' : ''}${isMobile ? ' mobile' : ''}${isMobile && mobileOpen ? ' mobile-open' : ''}`}
        animate={isMobile
          ? { x: mobileOpen ? 0 : -EXPANDED_WIDTH }
          : { width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }
        }
        initial={false}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
      >
        {/* Logo */}
        <div className={`sidebar-logo-area${isCollapsed ? ' sidebar-logo-area--collapsed' : ''}`}>
          {isCollapsed ? (
            <img src={logoMark} alt="BL" className="sidebar-logo-mark" />
          ) : (
            <div className="sidebar-logo-expanded">
              <img src={logoFull} alt="BioLuminux" className="sidebar-logo-full" />
              <span className="sidebar-logo-tagline">Clinical Research CRM</span>
            </div>
          )}
          {/* Collapse toggle sits in logo row — always visible, desktop only */}
          {!isMobile && (
            <button
              className="sidebar-collapse-btn sidebar-collapse-btn--inline"
              onClick={toggle}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              <span className="sidebar-collapse-track">
                {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
              </span>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV.map((item) => {
            if (!item.section) {
              return <NavItem key={item.path} item={item} collapsed={isCollapsed} onNavigate={() => isMobile && setMobileOpen(false)} />;
            }
            return (
              <div key={item.section} className="sidebar-section">
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      className="sidebar-section-label"
                    >
                      {item.section}
                    </motion.span>
                  )}
                </AnimatePresence>
                {item.items.map(sub => (
                  <NavItem key={sub.path} item={sub} collapsed={isCollapsed} onNavigate={() => isMobile && setMobileOpen(false)} />
                ))}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="sidebar-help"
              >
                Help &amp; support
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!isCollapsed && user?.workspace && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="sidebar-workspace"
              >
                <Building2 size={14} />
                <div>
                  <div className="sidebar-workspace-label">WORKSPACE</div>
                  <div className="sidebar-workspace-name">{user.workspace.name}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>
    </>
  );
}

function NavItem({ item, collapsed, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
    >
      <span className="sidebar-nav-icon">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15 }}
            className="sidebar-nav-label"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </NavLink>
  );
}
