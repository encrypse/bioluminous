import { useEffect, useRef, useState } from 'react';
import { Activity, TrendingUp, Users, Phone } from 'lucide-react';
import './LiveOpsTicker.css';

const TICKER_ITEMS = [
  { icon: 'activity', text: 'Esther Okeke — Pre-screening booked for 14:30 BST' },
  { icon: 'trending', text: 'New lead added: James Whitfield — BUP Study 2' },
  { icon: 'phone', text: 'Call completed: Jonah Ochigbo — Duration 18 min' },
  { icon: 'users', text: 'Pipeline update: Sarah Mensah moved to Randomised' },
  { icon: 'activity', text: 'Task due today: Follow-up call with Mark Davies' },
  { icon: 'trending', text: 'Campaign milestone: Hypertension Research — 80% enrolled' },
  { icon: 'phone', text: 'Missed call from David Asante — requires callback' },
  { icon: 'users', text: 'Staff online: 4 recruiters active' },
];

const IconMap = { activity: Activity, trending: TrendingUp, users: Users, phone: Phone };

export default function LiveOpsTicker() {
  const trackRef = useRef(null);
  const [paused, setPaused] = useState(false);

  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div
      className="ticker-bar"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="ticker-label">
        <span className="ticker-dot" />
        LIVE OPS
      </div>
      <div className="ticker-track-wrap">
        <div className={`ticker-track ${paused ? 'paused' : ''}`} ref={trackRef}>
          {items.map((item, i) => {
            const Icon = IconMap[item.icon] || Activity;
            return (
              <span key={i} className="ticker-item">
                <Icon size={11} />
                {item.text}
                <span className="ticker-sep">·</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
