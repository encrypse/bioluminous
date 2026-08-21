import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneCall, PhoneMissed, PhoneOff, Clock, Sparkles,
  CheckCircle, XCircle, Inbox, Wifi, Shield, Users,
  PhoneIncoming, AlertCircle, Calendar, ChevronRight,
  Hash, Mic, MicOff, TrendingUp, Activity
} from 'lucide-react';
import { getCalls, getCallStats, getStaff, getParticipants, updateCall } from '../api';
import { BioLoaderPage } from '../components/ui/BioLoader';
import { humanize } from '../utils/humanize';
import './Calls.css';

/* ── helpers ── */
function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((day + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10), label: `${fmt(mon)} to ${fmt(sun)}` };
}

function getDayRange() {
  const now = new Date();
  const d = now.toISOString().slice(0, 10);
  const fmt = (d2) => d2.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return { from: d, to: d, label: `${fmt(now)}` };
}

function getMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10), label: `${fmt(first)} to ${fmt(last)}` };
}

function getYearRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), 0, 1);
  const last = new Date(now.getFullYear(), 11, 31);
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10), label: `${fmt(first)} to ${fmt(last)}` };
}

function LiveTimer({ startedAt }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const base = startedAt ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000) : 0;
    setSecs(base);
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span className="live-timer">{formatDuration(secs)}</span>;
}

/* ── main component ── */
export default function Calls() {
  const qc = useQueryClient();

  /* period state */
  const [period, setPeriod] = useState('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [appliedCustom, setAppliedCustom] = useState(null);
  const [aiEdits, setAiEdits] = useState({});

  function getRange() {
    if (period === 'day') return getDayRange();
    if (period === 'week') return getWeekRange();
    if (period === 'month') return getMonthRange();
    if (period === 'year') return getYearRange();
    if (period === 'custom' && appliedCustom) return appliedCustom;
    return getWeekRange();
  }

  const range = getRange();

  /* queries */
  const { data: stats } = useQuery({
    queryKey: ['call-stats', range.from, range.to],
    queryFn: () => getCallStats({ from: range.from, to: range.to }).then(r => r.data),
  });

  const { data: callsData, isLoading: callsLoading } = useQuery({
    queryKey: ['calls', range.from, range.to],
    queryFn: () => getCalls({ from: range.from, to: range.to, page_size: 100 }).then(r => r.data.results ?? r.data),
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => getStaff().then(r => r.data.results ?? r.data),
  });

  const { data: newLeadsData } = useQuery({
    queryKey: ['participants-not-called'],
    queryFn: () => getParticipants({ call_status: 'not_called', page_size: 20 }).then(r => r.data.results ?? r.data),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, summary }) => updateCall(id, { ai_review_status: 'approved', ai_summary: summary }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calls'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => updateCall(id, { ai_review_status: 'rejected' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calls'] }),
  });

  const calls = callsData || [];
  const staff = staffData || [];
  const newLeads = newLeadsData || [];

  if (callsLoading) return <BioLoaderPage text="Loading…" />;

  /* derived */
  const liveCalls = calls.filter(c => c.status === 'live' || c.status === 'ringing');
  const myQueue = calls.filter(c => c.status === 'queued');
  const overdue = calls.filter(c => c.is_overdue || c.outcome === 'no_answer');
  const missedCallbacks = calls.filter(c => c.outcome === 'missed' || c.outcome === 'inbound_missed');
  const history = calls.filter(c => !['live', 'ringing', 'queued'].includes(c.status));
  const aiPending = calls.filter(c => c.ai_summary && c.ai_review_status !== 'approved' && c.ai_review_status !== 'rejected');

  /* kpi helpers */
  const weekTotal = stats?.calls_this_week ?? stats?.calls_this_period ?? calls.length ?? 0;
  const weekCompleted = stats?.calls_completed ?? calls.filter(c => c.outcome === 'connected').length ?? 0;
  const todayTotal = stats?.calls_today ?? 0;
  const liveCount = stats?.live_calls ?? liveCalls.length ?? 0;
  const missedFailed = stats?.missed_failed ?? (stats?.missed ?? 0) + (stats?.failed ?? 0);
  const avgDurSecs = stats?.avg_duration_seconds ?? 0;
  const totalTalk = stats?.total_talk_seconds ?? 0;
  const connectedCount = stats?.connected_calls ?? 0;

  return (
    <div className="calls-page">

      {/* ── CALL REPORTING WINDOW ── */}
      <motion.div
        className="calls-reporting-card"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="calls-reporting-header">
          <div>
            <h2 className="calls-reporting-title">Call reporting window</h2>
            <p className="calls-reporting-sub">
              Showing totals for this {period === 'custom' ? 'range' : period} from {range.label}.
            </p>
          </div>
          <div className="calls-period-tabs">
            {['day', 'week', 'month', 'year', 'custom'].map(p => (
              <button
                key={p}
                className={`calls-period-tab${period === p ? ' active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {period === 'custom' && (
            <motion.div
              className="calls-date-inputs"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <label className="calls-date-label">From</label>
              <input
                type="date"
                className="calls-date-input"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
              />
              <label className="calls-date-label">To</label>
              <input
                type="date"
                className="calls-date-input"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
              />
              <button
                className="calls-apply-btn"
                onClick={() => {
                  if (customFrom && customTo) {
                    const fmt = (s) => new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    setAppliedCustom({ from: customFrom, to: customTo, label: `${fmt(customFrom)} to ${fmt(customTo)}` });
                  }
                }}
              >
                Apply custom
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── KPI CARDS ── */}
      <div className="calls-kpi-grid">
        {[
          {
            label: 'Calls this week',
            value: weekTotal,
            sub: `${weekCompleted} completed`,
            subColor: 'green',
            icon: Phone,
            accent: '#0a7c68',
          },
          {
            label: 'Calls today',
            value: todayTotal,
            sub: 'Current day volume',
            subColor: 'blue',
            icon: Activity,
            accent: '#2563eb',
          },
          {
            label: 'Live calls',
            value: liveCount,
            sub: 'Browser dialler active',
            subColor: liveCount > 0 ? 'green' : 'gray',
            icon: Wifi,
            accent: '#059669',
          },
          {
            label: 'Missed / Failed',
            value: missedFailed,
            sub: 'This week issues',
            subColor: missedFailed > 0 ? 'red' : 'gray',
            icon: PhoneMissed,
            accent: '#dc2626',
          },
          {
            label: 'Avg duration',
            value: formatDuration(avgDurSecs),
            sub: `${connectedCount} connected`,
            subColor: 'purple',
            icon: Clock,
            accent: '#7c3aed',
          },
          {
            label: 'Total talk time',
            value: formatDuration(totalTalk),
            sub: 'This week',
            subColor: 'teal',
            icon: TrendingUp,
            accent: '#0891b2',
          },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            className="calls-kpi-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <div className="calls-kpi-icon-row">
              <span className="calls-kpi-icon" style={{ background: `${kpi.accent}14`, color: kpi.accent }}>
                <kpi.icon size={14} />
              </span>
            </div>
            <div className="calls-kpi-label">{kpi.label}</div>
            <div className="calls-kpi-value">{kpi.value}</div>
            <span className={`calls-kpi-sub sub-${kpi.subColor}`}>{kpi.sub}</span>
          </motion.div>
        ))}
      </div>

      {/* ── ROW 1: Live Operations + Live Calls ── */}
      <div className="calls-two-col">
        {/* Live Operations */}
        <div className="calls-section-card">
          <h3 className="calls-section-title">
            <Activity size={15} style={{ color: '#059669' }} />
            Live operations
          </h3>
          <div className="calls-status-block">
            <span className="calls-status-header online">CALLING SYSTEM ONLINE</span>
            <p className="calls-status-text">
              Facebook lead capture monitored, call tracking online, AI summary review active, audit trail active.
            </p>
          </div>
          <div className="calls-status-block">
            <span className="calls-status-header compliance">COMPLIANCE</span>
            <p className="calls-status-text">
              Recording consent, DNC enforcement, transcript protection, and role-based call access are active.
            </p>
          </div>
          <div className="calls-status-indicators">
            {[
              { label: 'Facebook capture', on: true },
              { label: 'Call tracking', on: true },
              { label: 'AI summaries', on: true },
              { label: 'Audit trail', on: true },
              { label: 'DNC enforcement', on: true },
              { label: 'Recording consent', on: true },
            ].map(ind => (
              <div key={ind.label} className="calls-status-indicator">
                <span className={`status-dot ${ind.on ? 'dot-green' : 'dot-gray'}`} />
                <span>{ind.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live calls in progress */}
        <div className="calls-section-card">
          <h3 className="calls-section-title">
            <PhoneCall size={15} style={{ color: '#059669' }} />
            Live calls in progress
            {liveCount > 0 && <span className="calls-live-badge">{liveCount} active</span>}
          </h3>
          {liveCalls.length === 0 ? (
            <div className="calls-empty">
              <PhoneOff size={28} strokeWidth={1.2} />
              <p className="calls-empty-title">No live calls</p>
              <p className="calls-empty-sub">Active ringing and connected sessions will appear here.</p>
            </div>
          ) : (
            <div className="calls-live-list">
              {liveCalls.map(c => (
                <div key={c.id} className="calls-live-item">
                  <div className="calls-live-pulse" />
                  <div className="calls-live-info">
                    <span className="calls-live-name">{c.participant?.name || 'Unknown'}</span>
                    <span className="calls-live-staff">{c.staff?.full_name || c.staff?.username || '—'}</span>
                  </div>
                  <div className="calls-live-right">
                    <LiveTimer startedAt={c.started_at || c.created_at} />
                    <span className={`calls-live-status-badge ${c.status === 'live' ? 'status-connected' : 'status-ringing'}`}>
                      {c.status === 'live' ? 'Connected' : 'Ringing'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 2: My Call Queue + New Leads ── */}
      <div className="calls-two-col">
        {/* My call queue */}
        <div className="calls-section-card">
          <h3 className="calls-section-title">
            <Inbox size={15} style={{ color: '#7c3aed' }} />
            My call queue
          </h3>
          {myQueue.length === 0 ? (
            <div className="calls-empty">
              <Inbox size={28} strokeWidth={1.2} />
              <p className="calls-empty-title">Queue is clear</p>
              <p className="calls-empty-sub">No leads currently fall into this call bucket.</p>
            </div>
          ) : (
            <div>
              {myQueue.map(c => (
                <div key={c.id} className="calls-queue-item">
                  <div>
                    <div className="calls-queue-name">{c.participant?.name || '—'}</div>
                    <div className="calls-queue-meta">{c.participant?.phone || '—'}</div>
                  </div>
                  <button
                    className="btn-call-lead"
                    onClick={() => window.open(`tel:${c.participant?.phone}`, '_self')}
                  >
                    <Phone size={11} /> Call
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New leads to call */}
        <div className="calls-section-card">
          <h3 className="calls-section-title">
            <Users size={15} style={{ color: '#0891b2' }} />
            New leads to call
          </h3>
          {newLeads.length === 0 ? (
            <div className="calls-empty">
              <Phone size={28} strokeWidth={1.2} />
              <p className="calls-empty-title">No new leads</p>
              <p className="calls-empty-sub">Uncalled leads will appear here as they arrive.</p>
            </div>
          ) : (
            <div>
              {newLeads.map(p => (
                <div key={p.id} className="calls-queue-item">
                  <div className="calls-new-lead-info">
                    <div className="calls-queue-name">{p.name || p.full_name || '—'}</div>
                    <div className="calls-queue-label">Clinical lead queue</div>
                    <div className="calls-queue-meta">{p.phone || p.phone_number || '—'}</div>
                    <div className="calls-queue-meta calls-last-call">
                      {p.last_call_at
                        ? `Last call: ${new Date(p.last_call_at).toLocaleDateString('en-GB')}`
                        : 'No previous calls'}
                    </div>
                  </div>
                  <button
                    className="btn-call-lead"
                    onClick={() => window.open(`tel:${p.phone || p.phone_number}`, '_self')}
                  >
                    <Phone size={11} /> Call lead
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 3: Overdue + Missed Callbacks ── */}
      <div className="calls-two-col">
        {/* Overdue calls */}
        <div className="calls-section-card">
          <h3 className="calls-section-title">
            <AlertCircle size={15} style={{ color: '#d97706' }} />
            Overdue calls
          </h3>
          {overdue.length === 0 ? (
            <div className="calls-empty">
              <CheckCircle size={28} strokeWidth={1.2} style={{ color: '#059669' }} />
              <p className="calls-empty-title">No overdue calls</p>
              <p className="calls-empty-sub">All booked leads have been contacted within 24 hours.</p>
            </div>
          ) : (
            <div>
              {overdue.map(c => (
                <div key={c.id} className="calls-queue-item">
                  <div>
                    <div className="calls-queue-name">{c.participant?.name || '—'}</div>
                    <div className="calls-queue-meta">
                      <Calendar size={10} />
                      {c.scheduled_at ? new Date(c.scheduled_at).toLocaleDateString('en-GB') : 'Unscheduled'}
                    </div>
                  </div>
                  <span className="badge-overdue">Overdue</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Missed callbacks */}
        <div className="calls-section-card">
          <h3 className="calls-section-title">
            <PhoneIncoming size={15} style={{ color: '#dc2626' }} />
            Missed callbacks / follow-up due
          </h3>
          {missedCallbacks.length === 0 ? (
            <div className="calls-empty">
              <CheckCircle size={28} strokeWidth={1.2} style={{ color: '#059669' }} />
              <p className="calls-empty-title">All clear</p>
              <p className="calls-empty-sub">No missed callbacks or follow-ups outstanding.</p>
            </div>
          ) : (
            <div>
              {missedCallbacks.map(c => (
                <div key={c.id} className="calls-queue-item">
                  <div>
                    <div className="calls-queue-name">{c.participant?.name || '—'}</div>
                    <div className="calls-queue-meta">{c.participant?.phone || '—'}</div>
                  </div>
                  <div className="calls-queue-item-right">
                    <span className="badge-missed">Missed</span>
                    <button
                      className="btn-call-lead"
                      onClick={() => window.open(`tel:${c.participant?.phone}`, '_self')}
                    >
                      <Phone size={11} /> Call back
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 4: Call History + AI Summary Review ── */}
      <div className="calls-two-col">
        {/* Call history */}
        <div className="calls-section-card">
          <h3 className="calls-section-title">
            <Clock size={15} style={{ color: '#64748b' }} />
            Call history and missed inbound calls
          </h3>
          {callsLoading ? (
            <div className="calls-skeleton-list">
              {[1,2,3].map(i => <div key={i} className="skeleton calls-skeleton-row" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="calls-empty">
              <Phone size={28} strokeWidth={1.2} />
              <p className="calls-empty-title">No call history</p>
              <p className="calls-empty-sub">Completed and missed calls will appear here.</p>
            </div>
          ) : (
            <div>
              {history.slice(0, 10).map(c => {
                const outcomeStyle = {
                  connected: { bg: '#ecfdf5', color: '#059669' },
                  voicemail: { bg: '#eff6ff', color: '#2563eb' },
                  no_answer: { bg: '#fffbeb', color: '#d97706' },
                  missed: { bg: '#fef2f2', color: '#dc2626' },
                  failed: { bg: '#fef2f2', color: '#dc2626' },
                  inbound_missed: { bg: '#f3f4f6', color: '#6b7280' },
                  not_interested: { bg: '#fee2e2', color: '#b91c1c' },
                }[c.outcome] || { bg: '#f1f5f9', color: '#64748b' };

                return (
                  <div key={c.id} className="calls-history-item">
                    <div className="calls-history-header">
                      <span className="badge-ended">Ended</span>
                      <span className="calls-history-name">{c.participant?.name || '—'}</span>
                      {c.outcome && (
                        <span className="outcome-chip" style={{ background: outcomeStyle.bg, color: outcomeStyle.color }}>
                          {humanize(c.outcome)}
                        </span>
                      )}
                    </div>
                    <div className="calls-history-meta">
                      <span>
                        <Users size={10} />
                        {c.staff?.full_name || c.staff?.username || '—'}
                      </span>
                      <span>
                        <Calendar size={10} />
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </span>
                      <span>
                        <Clock size={10} />
                        {c.duration_formatted || formatDuration(c.duration_seconds) || '—'}
                      </span>
                      <span>
                        {c.recording_url
                          ? <><Mic size={10} style={{ color: '#059669' }} /> Recording</>
                          : <><MicOff size={10} /> No recording</>
                        }
                      </span>
                    </div>
                    {(c.notes || c.ai_summary) && (
                      <p className="calls-history-note">
                        {c.notes || (c.ai_summary ? c.ai_summary.slice(0, 120) + '…' : '')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Summary Review */}
        <div className="calls-section-card">
          <h3 className="calls-section-title">
            <Sparkles size={15} style={{ color: '#f59e0b' }} />
            AI summary review
          </h3>
          {aiPending.length === 0 ? (
            <div className="calls-empty">
              <CheckCircle size={28} strokeWidth={1.2} style={{ color: '#059669' }} />
              <p className="calls-empty-title">All summaries reviewed</p>
              <p className="calls-empty-sub">No pending AI summaries. Great work keeping on top of reviews.</p>
            </div>
          ) : (
            <div>
              {aiPending.slice(0, 5).map(c => {
                const editedSummary = aiEdits[c.id] ?? c.ai_summary;
                return (
                  <div key={c.id} className="calls-ai-item">
                    <div className="calls-ai-item-header">
                      <span className="badge-needs-review">
                        <Sparkles size={9} /> Needs review
                      </span>
                      <span className="calls-ai-date">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                      </span>
                    </div>
                    <div className="calls-ai-who">{c.participant?.name || 'Unknown participant'}</div>
                    <textarea
                      className="calls-ai-textarea"
                      value={editedSummary}
                      onChange={e => setAiEdits(prev => ({ ...prev, [c.id]: e.target.value }))}
                    />
                    <div className="calls-ai-actions">
                      <button
                        className="btn-ai-reject"
                        onClick={() => rejectMutation.mutate(c.id)}
                        disabled={rejectMutation.isPending}
                      >
                        <XCircle size={12} /> Reject
                      </button>
                      <button
                        className="btn-ai-save"
                        onClick={() => {
                          setAiEdits(prev => ({ ...prev, [c.id]: editedSummary }));
                        }}
                      >
                        Save edit
                      </button>
                      <button
                        className="btn-ai-approve"
                        onClick={() => approveMutation.mutate({ id: c.id, summary: editedSummary })}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle size={12} /> Approve
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── FULL WIDTH: Staff Performance ── */}
      <div className="calls-section-card calls-full-width">
        <h3 className="calls-section-title">
          <TrendingUp size={15} style={{ color: '#0a7c68' }} />
          Staff performance and admin controls
        </h3>

        <div className="calls-staff-tel-note">
          <Hash size={12} />
          <span><strong>Telephony numbers</strong> — 1 active number configured for the organisation.</span>
        </div>

        {/* Staff table header */}
        <div className="calls-staff-header-row">
          <span>Staff member</span>
          <span>Calls</span>
          <div className="calls-staff-stats-header">
            <span>Connected</span>
            <span>Completed</span>
            <span>Total talk time</span>
            <span>Booked</span>
            <span>Avg duration</span>
          </div>
        </div>

        {staff.length === 0 ? (
          <div className="calls-staff-empty">No staff records found.</div>
        ) : (
          staff.map((s, i) => {
            const sCalls = calls.filter(c => c.staff?.id === s.id || c.staff?.username === s.username);
            const connected = sCalls.filter(c => c.outcome === 'connected').length;
            const completed = sCalls.filter(c => ['connected', 'voicemail'].includes(c.outcome)).length;
            const totalSecs = sCalls.reduce((acc, c) => acc + (c.duration_seconds || 0), 0);
            const booked = sCalls.filter(c => c.booking_created).length;
            const avgSecs = sCalls.length ? Math.round(totalSecs / sCalls.length) : 0;

            return (
              <motion.div
                key={s.id}
                className="calls-staff-row"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="calls-staff-name">
                  <div className="calls-staff-avatar">
                    {(s.full_name || s.username || 'S').charAt(0).toUpperCase()}
                  </div>
                  <span>{s.full_name || s.username}</span>
                </div>
                <div className="calls-staff-count">{sCalls.length} calls</div>
                <div className="calls-staff-stats">
                  <span><span className="stat-label">Connected:</span>{connected}</span>
                  <span><span className="stat-label">Completed:</span>{completed}</span>
                  <span><span className="stat-label">Total talk time:</span>{formatDuration(totalSecs)}</span>
                  <span><span className="stat-label">Booked:</span>{booked}</span>
                  <span><span className="stat-label">Avg duration:</span>{formatDuration(avgSecs)}</span>
                </div>
              </motion.div>
            );
          })
        )}

        <p className="calls-staff-footer">
          Admin can review recordings, manage call rules, and compare staff call output across day, week, month, year, and custom ranges from this screen.
        </p>
      </div>

    </div>
  );
}
