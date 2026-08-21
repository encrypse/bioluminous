import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Users, Phone, Calendar, TrendingUp, Download, FileText,
  Inbox, Sparkles, AlertTriangle, CheckCircle2, ChevronRight,
  Target, Clock, UserX, Radio, Megaphone, Zap, RotateCcw,
  BarChart2, Activity
} from 'lucide-react';
import { getDashboardStats, getCallStats, getStaff, getCampaigns, getCommStats } from '../api';
import { humanize } from '../utils/humanize';
import './Reports.css';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());


function exportCSV(rows, filename) {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const TEAL = '#0a7c68';
const BLUE = '#1d4ed8';
const NAVY = '#1e293b';
const CYAN = '#0ea5e9';

const CHART_COLORS = ['#0a7c68', '#1d4ed8', '#7c3aed', '#f59e0b', '#ef4444', '#06b6d4', '#10b981', '#8b5cf6'];

const FUNNEL_STAGES = [
  { key: 'new_lead', label: 'NEW LEAD' },
  { key: 'auto_contacted', label: 'AUTO CONTACTED' },
  { key: 'booking_pending', label: 'BOOKING PENDING' },
  { key: 'pre_screening_booked', label: 'PRE-SCREENING BOOKED' },
  { key: 'called', label: 'CALLED' },
  { key: 'pre_screening_completed', label: 'PRE-SCREENING COMPLETED' },
  { key: 'qualified', label: 'QUALIFIED' },
  { key: 'not_qualified', label: 'NOT QUALIFIED' },
];

// ── sub-components ────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, index }) {
  return (
    <motion.div
      className="reports-kpi-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
    >
      <div>
        <div className="reports-kpi-label">{label}</div>
        <div className="reports-kpi-value">{fmt(value)}</div>
        <div className="reports-kpi-sub">{sub}</div>
      </div>
    </motion.div>
  );
}

function SectionCard({ children, className = '', style }) {
  return (
    <div className={`reports-section-card ${className}`} style={style}>
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="reports-chart-tooltip">
      <div className="reports-chart-tooltip-label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="reports-chart-tooltip-row" style={{ color: p.color }}>
          <span className="reports-chart-tooltip-dot" style={{ background: p.color }} />
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ── main component ────────────────────────────────────────────────────────────
export default function Reports() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [fromDate, setFromDate] = useState(thirtyDaysAgo.toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(today.toISOString().slice(0, 10));
  const [staffFilter, setStaffFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', fromDate, toDate],
    queryFn: () => getDashboardStats({ from: fromDate, to: toDate }).then(r => r.data),
  });

  const { data: callStats } = useQuery({
    queryKey: ['call-stats', fromDate, toDate],
    queryFn: () => getCallStats({ from: fromDate, to: toDate }).then(r => r.data),
  });

  const { data: staffList } = useQuery({
    queryKey: ['staff'],
    queryFn: () => getStaff().then(r => r.data?.results ?? r.data ?? []),
  });

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => getCampaigns().then(r => r.data?.results ?? r.data ?? []),
  });

  const { data: commStats } = useQuery({
    queryKey: ['comm-stats', fromDate, toDate],
    queryFn: () => getCommStats({ from: fromDate, to: toDate }).then(r => r.data),
  });

  const dailyData = useMemo(() => {
    if (!stats?.lead_timeseries?.length) return [];
    return stats.lead_timeseries.map(d => {
      const dt = new Date(d.date);
      const label = `${dt.getDate()}/${dt.getMonth() + 1}`;
      const convRate = d.leads > 0 ? Math.round((d.bookings / d.leads) * 100) : 0;
      return { date: label, leads: d.leads, bookings: d.bookings, convRate };
    });
  }, [stats]);

  const weeklyNoShow = useMemo(() => {
    if (!stats?.lead_timeseries?.length) return [];
    // Group into weeks and compute no-show approximation from pipeline data
    const noShowCount = stats?.no_shows ?? 0;
    const total = stats?.total_leads ?? 1;
    const rate = total > 0 ? Math.round((noShowCount / total) * 100) : 0;
    return [{ week: 'Current', rate }];
  }, [stats]);

  // Pipeline distribution
  const rawPipeline = useMemo(() => {
    if (!stats?.pipeline_distribution) return [];
    const d = stats.pipeline_distribution;
    if (Array.isArray(d)) return d.map(x => ({ stage: x.stage, count: x.count }));
    return Object.entries(d).map(([stage, count]) => ({ stage, count }));
  }, [stats]);

  const totalLeads = stats?.total_leads ?? (rawPipeline.reduce((s, p) => s + (p.count || 0), 0)) || 0;

  const funnelData = useMemo(() => {
    const byStage = {};
    rawPipeline.forEach(p => { byStage[p.stage] = p.count || 0; });
    const total = totalLeads || 1;
    return FUNNEL_STAGES.map(s => ({
      ...s,
      count: byStage[s.key] ?? 0,
      pct: Math.round(((byStage[s.key] ?? 0) / total) * 100),
    }));
  }, [rawPipeline, totalLeads]);

  // Call stats by staff
  const callsByStaff = useMemo(() => {
    if (callStats?.by_staff?.length) return callStats.by_staff;
    if (!staffList?.length) return [];
    // compute from staff names only, no fake numbers
    return staffList.slice(0, 5).map(s => ({
      name: `${s.first_name} ${s.last_name}`.trim() || s.username,
      answered: 0, no_answer: 0,
    }));
  }, [callStats, staffList]);

  // Call outcome distribution
  const callOutcomes = useMemo(() => {
    if (callStats?.outcomes?.length) return callStats.outcomes;
    return [];
  }, [callStats]);

  // Comm delivery stats
  const commDelivery = useMemo(() => {
    if (!commStats) return [];
    return [
      { name: 'Sent', value: commStats.sms_count + commStats.email_count || 0, fill: CYAN },
      { name: 'Delivered', value: commStats.delivered || 0, fill: TEAL },
      { name: 'Received', value: commStats.received || 0, fill: BLUE },
      { name: 'Failed', value: commStats.failed || 0, fill: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [commStats]);

  // Lead source performance
  const leadSources = useMemo(() => {
    if (!stats?.pipeline_distribution?.length) return [];
    // Backend doesn't provide source breakdown yet — return empty until endpoint exists
    return [];
  }, [stats]);

  // Campaign comparison
  const campaignData = useMemo(() => {
    if (!campaigns?.length) return [];
    return campaigns.slice(0, 5).map(c => ({
      name: c.name?.substring(0, 12) ?? 'Campaign',
      leads: c.participant_count ?? c.leads_count ?? 0,
      bookings: c.bookings_count ?? 0,
      qualified: c.qualified_count ?? 0,
    }));
  }, [campaigns]);

  const slaBreaches = callStats?.sla_breaches ?? 0;
  const callMinutes = Math.round((callStats?.total_talk_time_seconds ?? 0) / 60);
  const qualRate = stats?.conversion_rate != null
    ? stats.conversion_rate
    : totalLeads > 0
      ? Math.round(((stats?.qualified_leads ?? 0) / totalLeads) * 100)
      : 0;

  const resetFilters = useCallback(() => {
    setFromDate(thirtyDaysAgo.toISOString().slice(0, 10));
    setToDate(today.toISOString().slice(0, 10));
    setStaffFilter('');
    setSourceFilter('');
    setCampaignFilter('');
  }, []);

  const opsRows = [
    { metric: 'New leads', today: stats?.new_leads_today ?? 0, last7: '—', status: (stats?.new_leads_today ?? 0) < 2 ? 'Watch' : 'Healthy' },
    { metric: 'Appointments', today: stats?.pre_screenings_booked ?? 0, last7: '—', status: 'Healthy' },
    { metric: 'Calls completed', today: callStats?.calls_today ?? 0, last7: '—', status: (callStats?.calls_today ?? 0) < 3 ? 'Watch' : 'Healthy' },
    { metric: 'Messages processed', today: '—', last7: '—', status: 'Healthy' },
    { metric: 'Overdue follow-ups', today: stats?.leads_not_contacted ?? 0, last7: '—', status: (stats?.leads_not_contacted ?? 0) > 0 ? 'Watch' : 'Healthy' },
  ];

  const overdueList = stats?.overdue_participants ?? [];
  const recentAppts = stats?.recent_appointments ?? [];

  return (
    <div className="reports-page">
      {/* ── Header ── */}
      <div className="reports-header">
        <div className="reports-header-left">
          <h1 className="reports-title">Reports and Analytics</h1>
          <p className="reports-sub">Clinical trial pipeline performance, call metrics, and operational health.</p>
        </div>
        <div className="reports-header-badges">
          <span className="reports-badge reports-badge-export">
            <Download size={11} />
            Exports enabled
          </span>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="reports-filter-bar">
        <div className="reports-filter-group">
          <label className="reports-filter-label">FROM</label>
          <input type="date" className="reports-filter-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div className="reports-filter-group">
          <label className="reports-filter-label">TO</label>
          <input type="date" className="reports-filter-input" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        <div className="reports-filter-group">
          <label className="reports-filter-label">STAFF</label>
          <select className="reports-filter-input" value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
            <option value="">All staff</option>
            {(staffList ?? []).map(s => (
              <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
            ))}
          </select>
        </div>
        <div className="reports-filter-group">
          <label className="reports-filter-label">SOURCE</label>
          <select className="reports-filter-input" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
            <option value="">All sources</option>
            <option value="facebook">Facebook Ads</option>
            <option value="website">Website</option>
            <option value="gp">GP Referral</option>
            <option value="walk_in">Walk-in</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="reports-filter-group">
          <label className="reports-filter-label">CAMPAIGN</label>
          <select className="reports-filter-input" value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}>
            <option value="">All campaigns</option>
            {(campaigns ?? []).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button className="reports-reset-btn" onClick={resetFilters}>
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      {/* ── KPI cards ── */}
      <div className="reports-kpi-grid">
        <KpiCard
          index={0}
          label="Total Leads"
          value={totalLeads}
          sub="All participants"
        />
        <KpiCard
          index={1}
          label="Booked Pre-screenings"
          value={stats?.pre_screenings_booked ?? 0}
          sub={`${slaBreaches} breaching 24h call SLA`}
        />
        <KpiCard
          index={2}
          label="Calls Today"
          value={callStats?.calls_today ?? 0}
          sub={`${callMinutes} call minutes`}
        />
        <KpiCard
          index={3}
          label="Qualification Rate"
          value={`${qualRate}%`}
          sub={`${stats?.qualified_leads ?? 0} qualified leads`}
        />
      </div>

      {/* ── Conversion Funnel ── */}
      <motion.div
        className="reports-funnel-card reports-section-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <div className="reports-card-header">
          <div>
            <div className="reports-card-title">Conversion Funnel</div>
            <div className="reports-card-sub">New lead to completed pre-screening outcome.</div>
          </div>
          <span className="reports-badge reports-badge-info">
            <Activity size={11} /> Clinical communication funnel
          </span>
        </div>
        <div className="reports-funnel-steps">
          {funnelData.map((stage, i) => (
            <div key={stage.key} className="reports-funnel-step-wrapper">
              <div className="reports-funnel-step">
                <div className="reports-funnel-bar">
                  <div
                    className="reports-funnel-bar-fill"
                    style={{ width: `${Math.max(stage.pct, 4)}%` }}
                  />
                </div>
                <div className="reports-funnel-count">{stage.count}</div>
                <div className="reports-funnel-pct">{stage.pct}% of leads</div>
                <div className="reports-funnel-label">{stage.label}</div>
              </div>
              {i < funnelData.length - 1 && (
                <div className="reports-funnel-arrow">
                  <ChevronRight size={16} />
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Manager Insights ── */}
      <motion.div
        className="reports-section-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="reports-card-header" style={{ marginBottom: 14 }}>
          <div>
            <div className="reports-card-title">Manager Insights</div>
            <div className="reports-card-sub">Operational signals for response speed, workload and booking quality.</div>
          </div>
        </div>
        <div className="reports-insights-grid">
          {[
            {
              icon: <Target size={18} />,
              label: 'BEST CONVERTING SOURCE',
              value: sourceFilter ? humanize(sourceFilter) : (stats?.pipeline_distribution?.[0] ? '—' : 'No data'),
              sub: stats?.conversion_rate ? `${stats.conversion_rate}% conversion rate` : 'No conversion data',
              color: TEAL,
            },
            {
              icon: <Clock size={18} />,
              label: 'SLOWEST RESPONSE AREA',
              value: 'Tracking required',
              sub: 'Response tracking not yet configured',
              color: '#f59e0b',
            },
            {
              icon: <Users size={18} />,
              label: 'STAFF OVERDUE WORKLOAD',
              value: staffList?.[0] ? `${staffList[0].first_name} ${staffList[0].last_name}` : 'None assigned',
              sub: `${stats?.leads_not_contacted ?? 0} leads not contacted`,
              color: '#ef4444',
            },
            {
              icon: <UserX size={18} />,
              label: 'HIGHEST NO-SHOW PERIOD',
              value: stats?.no_shows ? `${stats.no_shows} no-shows` : 'No data',
              sub: 'Historical tracking required',
              color: '#7c3aed',
            },
            {
              icon: <Megaphone size={18} />,
              label: 'CAMPAIGN GENERATING BOOKINGS',
              value: campaigns?.[0]?.name ?? 'No campaigns',
              sub: campaigns?.length ? `${campaigns.length} campaigns active` : 'No campaigns configured',
              color: BLUE,
            },
          ].map((insight, i) => (
            <motion.div
              key={i}
              className="reports-insight-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + i * 0.05 }}
            >
              <div className="reports-insight-icon" style={{ color: insight.color, background: `${insight.color}14` }}>
                {insight.icon}
              </div>
              <div className="reports-insight-label">{insight.label}</div>
              <div className="reports-insight-value">{insight.value}</div>
              <div className="reports-insight-sub">{insight.sub}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Charts grid ── */}
      <div className="reports-charts-grid">

        {/* 1. Leads over time */}
        <div className="reports-chart-card">
          <div className="reports-chart-title"><TrendingUp size={14} /> Leads over time</div>
          <div className="reports-chart-sub">Daily new leads and booked pre-screenings over 30 days</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8f0ed" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="leads" stroke={TEAL} strokeWidth={2} dot={false} name="Leads" />
              <Line type="monotone" dataKey="bookings" stroke={BLUE} strokeWidth={2} dot={false} name="Bookings" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 2. Booking conversion */}
        <div className="reports-chart-card">
          <div className="reports-chart-title"><BarChart2 size={14} /> Booking conversion</div>
          <div className="reports-chart-sub">Daily booking conversion rate over 30 days</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8f0ed" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="convRate" stroke={CYAN} strokeWidth={2} dot={false} name="Conv. Rate" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 3. Calls by staff */}
        <div className="reports-chart-card">
          <div className="reports-chart-title"><Phone size={14} /> Calls by staff</div>
          <div className="reports-chart-sub">Answered vs no-answer per staff member</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={callsByStaff} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8f0ed" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="answered" fill={TEAL} radius={[3, 3, 0, 0]} name="Answered" />
              <Bar dataKey="no_answer" fill="#e2e8f0" radius={[3, 3, 0, 0]} name="No Answer" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 4. Call outcome distribution */}
        <div className="reports-chart-card">
          <div className="reports-chart-title"><Zap size={14} /> Call outcome distribution</div>
          <div className="reports-chart-sub">Call outcomes by staff member</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={callOutcomes} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8f0ed" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="qualified" fill={TEAL} radius={[3, 3, 0, 0]} name="Qualified" />
              <Bar dataKey="not_qualified" fill="#ef4444" radius={[3, 3, 0, 0]} name="Not Qualified" />
              <Bar dataKey="pending" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Pending" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 5. No-show trend */}
        <div className="reports-chart-card">
          <div className="reports-chart-title"><UserX size={14} /> No-show trend</div>
          <div className="reports-chart-sub">Weekly no-show rate</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyNoShow} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8f0ed" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="No-show %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 6. Communication delivery */}
        <div className="reports-chart-card">
          <div className="reports-chart-title"><Radio size={14} /> Communication delivery</div>
          <div className="reports-chart-sub">Sent / Delivered / Received / Failed breakdown</div>
          <div className="reports-donut-wrapper">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie data={commDelivery} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">
                  {commDelivery.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="reports-donut-legend">
              {commDelivery.map(d => (
                <div key={d.name} className="reports-donut-legend-row">
                  <span className="reports-donut-legend-dot" style={{ background: d.fill }} />
                  <span className="reports-donut-legend-name">{d.name}</span>
                  <span className="reports-donut-legend-val">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 7. Lead source performance */}
        <div className="reports-chart-card">
          <div className="reports-chart-title"><Target size={14} /> Lead source performance</div>
          <div className="reports-chart-sub">Lead volume by acquisition source</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={leadSources} layout="vertical" margin={{ top: 4, right: 8, left: 64, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8f0ed" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="source" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={64} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="leads" fill={TEAL} radius={[0, 3, 3, 0]} name="Leads" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 8. Campaign comparison */}
        <div className="reports-chart-card">
          <div className="reports-chart-title"><Megaphone size={14} /> Campaign comparison</div>
          <div className="reports-chart-sub">Leads, bookings and qualified by campaign</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={campaignData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8f0ed" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="leads" fill={CYAN} radius={[3, 3, 0, 0]} name="Leads" />
              <Bar dataKey="bookings" fill={BLUE} radius={[3, 3, 0, 0]} name="Bookings" />
              <Bar dataKey="qualified" fill={TEAL} radius={[3, 3, 0, 0]} name="Qualified" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 9. Campaign performance */}
        <div className="reports-chart-card">
          <div className="reports-chart-title"><BarChart2 size={14} /> Campaign performance</div>
          <div className="reports-chart-sub">Qualified participants vs total leads by campaign</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={campaignData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8f0ed" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="leads" fill="#e2e8f0" radius={[3, 3, 0, 0]} name="Total Leads" />
              <Bar dataKey="qualified" fill={TEAL} radius={[3, 3, 0, 0]} name="Qualified" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 10. Pipeline distribution */}
        <div className="reports-chart-card">
          <div className="reports-chart-title"><Users size={14} /> Pipeline distribution</div>
          <div className="reports-chart-sub">Participants by pipeline stage</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={funnelData.map(s => ({ name: s.label.split(' ').slice(0, 2).join(' '), count: s.count }))}
              layout="vertical"
              margin={{ top: 4, right: 8, left: 80, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e8f0ed" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill={NAVY} radius={[0, 3, 3, 0]} name="Participants" />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* ── AI Insights ── */}
      <motion.div
        className="reports-section-card reports-ai-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="reports-card-header">
          <div>
            <div className="reports-card-title reports-ai-title">
              <Sparkles size={16} className="reports-ai-sparkle" />
              AI insights
            </div>
            <div className="reports-card-sub">Operational observations generated from CRM data.</div>
          </div>
          <span className="reports-badge reports-badge-warn">
            <AlertTriangle size={11} /> Requires human review
          </span>
        </div>
        <div className="reports-ai-item">
          <div className="reports-ai-item-icon">
            <FileText size={14} />
          </div>
          <div className="reports-ai-item-body">
            <div className="reports-ai-item-title">Reporting summary ready</div>
            <div className="reports-ai-item-desc">Campaign, call and no-show observations will appear once live data is available.</div>
          </div>
          <span className="reports-ai-source">Source: derived</span>
        </div>
      </motion.div>

      {/* ── Daily Operations Report ── */}
      <motion.div
        className="reports-section-card reports-ops-table-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
      >
        <div className="reports-card-header">
          <div>
            <div className="reports-card-title">Daily Operations Report</div>
            <div className="reports-card-sub">Boardroom summary of today, the last 7 days and operational risk.</div>
          </div>
          <div className="reports-card-actions">
            <button
              className="reports-export-btn"
              onClick={() => exportCSV(opsRows, 'daily-ops-report.csv')}
            >
              <Download size={13} /> Export CSV
            </button>
            <button className="reports-export-btn reports-export-btn-muted">
              <FileText size={13} /> PDF planned
            </button>
          </div>
        </div>
        <table className="reports-table">
          <thead>
            <tr>
              <th>METRIC</th>
              <th>TODAY</th>
              <th>LAST 7 DAYS</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {opsRows.map(row => (
              <tr key={row.metric}>
                <td className="reports-table-metric">{row.metric}</td>
                <td>{fmt(row.today)}</td>
                <td>{fmt(row.last7)}</td>
                <td>
                  {row.status === 'Watch'
                    ? <span className="badge-watch"><AlertTriangle size={10} /> Watch</span>
                    : <span className="badge-healthy"><CheckCircle2 size={10} /> Healthy</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* ── Overdue Follow-up Risk ── */}
      <motion.div
        className="reports-section-card reports-overdue-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="reports-card-header">
          <div>
            <div className="reports-card-title">Overdue Follow-up Risk</div>
            <div className="reports-card-sub">Participants awaiting a call-back beyond the SLA window.</div>
          </div>
          <span className="reports-badge reports-badge-neutral">
            {overdueList.length} active
          </span>
        </div>
        {overdueList.length === 0 ? (
          <div className="reports-empty-state">
            <Inbox size={32} className="reports-empty-icon" />
            <span>No overdue follow-ups</span>
          </div>
        ) : (
          <table className="reports-table">
            <thead>
              <tr>
                <th>PARTICIPANT</th>
                <th>STAFF</th>
                <th>BOOKED</th>
                <th>HOURS WAITING</th>
              </tr>
            </thead>
            <tbody>
              {overdueList.map((row, i) => (
                <tr key={i}>
                  <td className="reports-table-name">{row.participant_name ?? '—'}</td>
                  <td>{row.staff_name ?? '—'}</td>
                  <td>{row.booked_at ? new Date(row.booked_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <span className="badge-watch">{row.hours_waiting ?? '?'}h</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* ── Recent Appointment Report ── */}
      <motion.div
        className="reports-section-card reports-appt-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
      >
        <div className="reports-card-header">
          <div>
            <div className="reports-card-title">Recent Appointment Report</div>
            <div className="reports-card-sub">Latest pre-screening appointments across all staff.</div>
          </div>
          <button
            className="reports-export-btn"
            onClick={() => exportCSV(recentAppts, 'recent-appointments.csv')}
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
        {recentAppts.length === 0 ? (
          <div className="reports-empty-state">
            <Calendar size={32} className="reports-empty-icon" />
            <span>No recent appointments</span>
          </div>
        ) : (
          <table className="reports-table">
            <thead>
              <tr>
                <th>PARTICIPANT</th>
                <th>TYPE</th>
                <th>STAFF</th>
                <th>STATUS</th>
                <th>DATE</th>
              </tr>
            </thead>
            <tbody>
              {recentAppts.map((row, i) => (
                <tr key={i}>
                  <td className="reports-table-name">{row.participant_name ?? '—'}</td>
                  <td>{humanize(row.type ?? 'pre_screening')}</td>
                  <td>{row.staff_name ?? '—'}</td>
                  <td>
                    <span className={`reports-status-badge reports-status-${row.status ?? 'scheduled'}`}>
                      {humanize(row.status ?? 'scheduled')}
                    </span>
                  </td>
                  <td>{row.date ? new Date(row.date).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
}
