import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Bell, LogOut, ChevronDown, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getNotifications, markNotificationRead } from '../../api';
import { getWorkspaceTz } from '../../utils/timezone';
import './Header.css';

function WorkspaceClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Read tz on every render so changes in Settings are reflected immediately
  const tz = getWorkspaceTz();

  const opts = { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const dateOpts = { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

  // Derive short timezone name e.g. "BST", "EST", "GMT+5"
  const tzShort = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' })
    .formatToParts(time)
    .find(p => p.type === 'timeZoneName')?.value ?? '';

  // Derive human label from tz string e.g. Europe/London → "LONDON TIME"
  const cityLabel = tz.split('/').pop().replace(/_/g, ' ').toUpperCase() + ' TIME';

  return (
    <div className="header-clock">
      <Clock size={13} />
      <div>
        <div className="header-clock-label">{cityLabel}</div>
        <div className="header-clock-date">{time.toLocaleDateString('en-GB', dateOpts)}</div>
        <div className="header-clock-time">{time.toLocaleTimeString('en-GB', opts)} {tzShort}</div>
      </div>
    </div>
  );
}

export default function Header({ sidebarWidth, onAddLead, isMobile }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getNotifications().then(r => setNotifs(r.data.results || r.data)).catch(() => {});
  }, []);

  const unreadCount = notifs.filter(n => !n.read_at).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className={`header${isMobile ? ' header-mobile' : ''}`} style={{ left: sidebarWidth, right: 0 }}>
      {/* Left: Clock (hidden on mobile to save space) */}
      {!isMobile && <WorkspaceClock />}

      {/* Right: actions */}
      <div className="header-right">
        {/* Search */}
        <div className="header-search">
          <Search size={14} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search leads, calls, tasks..."
          />
        </div>

        {/* Add Lead */}
        <button className="btn-primary-sm" onClick={onAddLead}>
          <Plus size={15} strokeWidth={2.5} /> Add Lead
        </button>

        {/* Notifications */}
        <div className="header-notif-wrapper">
          <button className="header-icon-btn" onClick={() => { setShowNotifs(v => !v); setShowUser(false); }}>
            <Bell size={17} />
            {unreadCount > 0 && <span className="header-badge">{unreadCount}</span>}
          </button>
          <AnimatePresence>
            {showNotifs && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="header-dropdown"
              >
                <div className="header-dropdown-title">Notifications</div>
                {notifs.length === 0 ? (
                  <div className="header-dropdown-empty">All caught up!</div>
                ) : (
                  notifs.slice(0, 5).map(n => (
                    <div
                      key={n.id}
                      className={`header-notif-item ${!n.read_at ? 'unread' : ''}`}
                      onClick={() => markNotificationRead(n.id).then(() =>
                        setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
                      )}
                    >
                      <div className="header-notif-dot" />
                      <p>{n.message}</p>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User menu */}
        <div className="header-user-wrapper">
          <button
            className="header-user-btn"
            onClick={() => { setShowUser(v => !v); setShowNotifs(false); }}
          >
            <div className="header-avatar">
              {user?.avatar_initials || user?.first_name?.[0] || 'U'}
            </div>
            <div className="header-user-info">
              <span className="header-user-name">{user?.full_name || user?.username}</span>
              <span className="header-user-role">{user?.role}</span>
            </div>
            <ChevronDown size={14} />
          </button>

          <AnimatePresence>
            {showUser && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="header-dropdown right-0"
              >
                <button className="header-dropdown-item danger" onClick={handleLogout}>
                  <LogOut size={14} /> Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Click outside to close */}
      {(showNotifs || showUser) && (
        <div className="header-overlay" onClick={() => { setShowNotifs(false); setShowUser(false); }} />
      )}
    </header>
  );
}
