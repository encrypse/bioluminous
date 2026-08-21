import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Calendar, Phone, AlertTriangle, TrendingUp, Activity, Clock, CheckSquare } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { getDashboardStats, getParticipants, getBookings, getCalls, getTasks } from '../api';
import { BioLoaderPage } from '../components/ui/BioLoader';
import { humanize } from '../utils/humanize';
import './Dashboard.css';

// Keyed by backend stage key AND display label for flexibility
const STAGE_COLORS = {
  new_lead: '#7c3aed', 'New Lead': '#7c3aed',
  auto_message_sent: '#6366f1', 'Auto Message Sent': '#6366f1',
  booking_pending: '#3b82f6', 'Booking Pending': '#3b82f6',
  pre_screening_booked: '#0ea5e9', 'Pre-screening Booked': '#0ea5e9',
  booked_not_called: '#06b6d4', 'Booked But Not Called': '#06b6d4',
  called: '#14b8a6', 'Called': '#14b8a6',
  no_answer: '#f59e0b', 'No Answer': '#f59e0b',
  call_back_later: '#d97706', 'Call Back Later': '#d97706',
  pre_screening_completed: '#2a9c5c', 'Pre-screening Completed': '#2a9c5c',
  qualified: '#16a34a', 'Qualified': '#16a34a',
  not_qualified: '#dc2626', 'Not Qualified': '#dc2626',
  no_show: '#9f1239', 'No Show': '#9f1239',
  opted_out: '#6b7280', 'Opted Out': '#6b7280',
};

function StatCard({ icon: Icon, label, value, delta, color, loading, delay = 0 }) {
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <div className="stat-card-header">
        <span className="stat-label">{label}</span>
        <span className="stat-icon" style={{ background: `${color}18`, color }}><Icon size={16} /></span>
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 36, width: 80, marginTop: 8 }} />
      ) : (
        <div className="stat-value">{value}</div>
      )}
      {delta !== undefined && (
        <div className={`stat-delta ${delta >= 0 ? 'up' : 'down'}`}>
          <TrendingUp size={11} />
          {delta >= 0 ? '+' : ''}{delta} today
        </div>
      )}
    </motion.div>
  );
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => getDashboardStats().then(r => r.data),
  });
  const { data: recentLeads } = useQuery({
    queryKey: ['participants', { page: 1 }],
    queryFn: () => getParticipants({ page: 1, page_size: 5 }).then(r => r.data.results || r.data),
  });
  const { data: upcomingBookings } = useQuery({
    queryKey: ['bookings', { page: 1 }],
    queryFn: () => getBookings({ page: 1, page_size: 5 }).then(r => r.data.results || r.data),
  });
  const { data: urgentTasks } = useQuery({
    queryKey: ['tasks', { status: 'pending' }],
    queryFn: () => getTasks({ status: 'pending', page_size: 5 }).then(r => r.data.results || r.data),
  });

  if (statsLoading) return <BioLoaderPage text="Loading dashboard…" />;

  const pipelineData = Array.isArray(stats?.pipeline_distribution)
    ? stats.pipeline_distribution.map(d => ({ name: humanize(d.stage), key: d.stage, value: d.count }))
    : Object.entries(stats?.pipeline_distribution || {}).map(([k, value]) => ({ name: humanize(k), key: k, value }));

  const weeklyData = (() => {
    const timeseries = stats?.lead_timeseries;
    if (!Array.isArray(timeseries) || timeseries.length === 0) return [];
    return timeseries.slice(-7).map(({ date, leads, bookings }) => ({
      day: SHORT_DAYS[new Date(date).getDay()],
      leads: leads ?? 0,
      bookings: bookings ?? 0,
    }));
  })();

  return (
    <div className="dashboard">
      {/* Page title */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Good morning — here's what's happening today.</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <StatCard icon={Users} label="Total Leads" value={stats?.total_leads ?? '—'} color="#00cba8" loading={statsLoading} delay={0} />
        <StatCard icon={Activity} label="New Leads Today" value={stats?.new_leads_today ?? '—'} delta={stats?.new_leads_today ?? 0} color="#7c3aed" loading={statsLoading} delay={0.05} />
        <StatCard icon={AlertTriangle} label="Not Contacted" value={stats?.leads_not_contacted ?? '—'} color="#ef4444" loading={statsLoading} delay={0.1} />
        <StatCard icon={Calendar} label="Pre-screenings Booked" value={stats?.pre_screenings_booked ?? '—'} color="#0ea5e9" loading={statsLoading} delay={0.15} />
        <StatCard icon={Phone} label="Booked — Not Called" value={stats?.booked_not_called ?? '—'} color="#f59e0b" loading={statsLoading} delay={0.2} />
      </div>

      {/* Charts row */}
      <div className="dash-charts">
        {/* Weekly activity */}
        <motion.div className="chart-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="chart-card-header">
            <h3>Weekly Activity</h3>
            <div className="chart-legend">
              <span className="legend-dot" style={{ background: '#00cba8' }} /> Leads
              <span className="legend-dot" style={{ background: '#7c3aed' }} /> Calls
              <span className="legend-dot" style={{ background: '#0ea5e9' }} /> Bookings
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00cba8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00cba8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2eeec" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#7a9e9e' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#7a9e9e' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2eeec', fontSize: 12 }} />
              <Area type="monotone" dataKey="leads" stroke="#00cba8" fill="url(#gLeads)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="calls" stroke="#7c3aed" fill="none" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              <Area type="monotone" dataKey="bookings" stroke="#0ea5e9" fill="none" strokeWidth={2} dot={false} strokeDasharray="2 2" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Pipeline distribution */}
        <motion.div className="chart-card chart-card-sm" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="chart-card-header">
            <h3>Pipeline Distribution</h3>
          </div>
          {pipelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pipelineData} layout="vertical" margin={{ top: 0, right: 8, left: 80, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2eeec" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#7a9e9e' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#4a7070' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2eeec', fontSize: 12 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {pipelineData.map((entry, idx) => (
                    <Cell key={idx} fill={STAGE_COLORS[entry.key || entry.name] || '#2a9c5c'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">No pipeline data yet</div>
          )}
        </motion.div>
      </div>

      {/* Bottom three panels */}
      <div className="dash-bottom">
        {/* Recent leads */}
        <motion.div className="dash-panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <div className="dash-panel-header">
            <h3>Recent Leads</h3>
            <a href="/leads" className="dash-panel-link">View all</a>
          </div>
          <div className="dash-list">
            {recentLeads?.length === 0 && <div className="dash-empty">No leads yet</div>}
            {recentLeads?.map(lead => (
              <a href={`/leads/${lead.id}`} key={lead.id} className="dash-list-item">
                <div className="dash-avatar">
                  {lead.first_name?.[0]}{lead.last_name?.[0]}
                </div>
                <div className="dash-list-info">
                  <span className="dash-list-name">{lead.first_name} {lead.last_name}</span>
                  <span className="dash-list-sub">{lead.stage_display || humanize(lead.stage)}</span>
                </div>
                <span className="dash-stage-dot" style={{ background: STAGE_COLORS[lead.stage] || '#2a9c5c' }} />
              </a>
            ))}
          </div>
        </motion.div>

        {/* Upcoming bookings */}
        <motion.div className="dash-panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="dash-panel-header">
            <h3>Upcoming Bookings</h3>
            <a href="/bookings" className="dash-panel-link">View all</a>
          </div>
          <div className="dash-list">
            {upcomingBookings?.length === 0 && <div className="dash-empty">No bookings</div>}
            {upcomingBookings?.map(b => (
              <div key={b.id} className="dash-list-item">
                <div className="dash-icon-wrap"><Calendar size={14} /></div>
                <div className="dash-list-info">
                  <span className="dash-list-name">{b.participant?.name || '—'}</span>
                  <span className="dash-list-sub">
                    {b.scheduled_at ? new Date(b.scheduled_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBC'}
                    {' · '}{b.booking_type_display || humanize(b.booking_type)}
                  </span>
                </div>
                <span className={`dash-badge dash-badge-${b.status}`}>{b.status_display || humanize(b.status)}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Urgent tasks */}
        <motion.div className="dash-panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <div className="dash-panel-header">
            <h3>Urgent Tasks</h3>
            <a href="/tasks" className="dash-panel-link">View all</a>
          </div>
          <div className="dash-list">
            {urgentTasks?.length === 0 && <div className="dash-empty">All tasks complete!</div>}
            {urgentTasks?.map(t => (
              <div key={t.id} className="dash-list-item">
                <div className="dash-icon-wrap"><CheckSquare size={14} /></div>
                <div className="dash-list-info">
                  <span className="dash-list-name">{t.description}</span>
                  <span className="dash-list-sub">
                    Due: {t.due_at ? new Date(t.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'No date'}
                    {t.participant?.name ? ` · ${t.participant.name}` : ''}
                  </span>
                </div>
                <span className={`dash-badge dash-badge-${t.priority || 'normal'}`}>{humanize(t.priority || 'normal')}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
