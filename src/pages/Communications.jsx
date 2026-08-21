import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Phone, Mail, ArrowUpRight, ArrowDownLeft,
  Plus, X, Search, Send, ChevronRight, Reply, User,
  CheckCircle, Clock, AlertCircle, Inbox,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCommunications, getCommStats, createCommunication, getParticipants } from '../api';
import { BioLoaderPage } from '../components/ui/BioLoader';
import { humanize } from '../utils/humanize';
import './Communications.css';

const TABS = [
  { key: 'all',   label: 'All',    icon: MessageSquare },
  { key: 'sms',   label: 'SMS',    icon: MessageSquare },
  { key: 'email', label: 'Email',  icon: Mail },
  { key: 'call',  label: 'Calls',  icon: Phone },
];

const TYPE_ICONS  = { sms: MessageSquare, email: Mail, call: Phone };
const STATUS_META = {
  sent:      { icon: ArrowUpRight, color: '#00cba8', label: 'Sent' },
  delivered: { icon: CheckCircle,  color: '#16a34a', label: 'Delivered' },
  received:  { icon: ArrowDownLeft,color: '#7c3aed', label: 'Received' },
  failed:    { icon: AlertCircle,  color: '#dc2626', label: 'Failed' },
  pending:   { icon: Clock,        color: '#d97706', label: 'Pending' },
};

function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  const now  = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Compose modal ─────────────────────────────────────────────────
function ComposeModal({ onClose, prefillParticipant, prefillType }) {
  const qc = useQueryClient();
  const [type, setType]         = useState(prefillType || 'sms');
  const [search, setSearch]     = useState(prefillParticipant?.name || '');
  const [participant, setParticipant] = useState(prefillParticipant || null);
  const [showDrop, setShowDrop] = useState(false);
  const [subject, setSubject]   = useState('');
  const [content, setContent]   = useState('');
  const [error, setError]       = useState('');
  const dropRef = useRef(null);

  const { data: searchResults } = useQuery({
    queryKey: ['participants-search', search],
    queryFn: () => getParticipants({ search, page_size: 10 }).then(r => r.data.results || r.data),
    enabled: search.length > 1 && !participant,
  });

  useEffect(() => {
    function onDown(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const mutation = useMutation({
    mutationFn: (data) => createCommunication(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communications'] });
      qc.invalidateQueries({ queryKey: ['comm-stats'] });
      onClose();
    },
    onError: (err) => setError(err?.response?.data?.detail || 'Failed to send. Try again.'),
  });

  function send() {
    if (!participant) { setError('Select a participant'); return; }
    if (!content.trim()) { setError('Message content is required'); return; }
    setError('');
    mutation.mutate({
      participant_id: participant.id,
      comm_type: type,
      direction: 'outbound',
      subject: subject.trim(),
      content: content.trim(),
      status: 'sent',
    });
  }

  return (
    <div className="comms-modal-overlay" onClick={onClose}>
      <motion.div
        className="comms-modal"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="comms-modal-header">
          <h3>Compose Message</h3>
          <button className="comms-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Type tabs */}
        <div className="comms-compose-types">
          {[{ key: 'sms', label: 'SMS', icon: MessageSquare }, { key: 'email', label: 'Email', icon: Mail }].map(t => (
            <button
              key={t.key}
              className={`comms-type-btn${type === t.key ? ' active' : ''}`}
              onClick={() => setType(t.key)}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {/* Participant search */}
        <div className="comms-compose-field">
          <label>To</label>
          {participant ? (
            <div className="comms-participant-pill">
              <User size={12} />
              <span>{participant.name}</span>
              <button onClick={() => { setParticipant(null); setSearch(''); }}><X size={11} /></button>
            </div>
          ) : (
            <div className="comms-participant-search" ref={dropRef}>
              <Search size={13} />
              <input
                autoFocus
                value={search}
                onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
                placeholder="Search participant…"
                onFocus={() => setShowDrop(true)}
              />
              {showDrop && searchResults?.length > 0 && (
                <div className="comms-participant-drop">
                  {searchResults.map(p => (
                    <button
                      key={p.id}
                      className="comms-participant-option"
                      onMouseDown={() => { setParticipant(p); setSearch(p.name); setShowDrop(false); }}
                    >
                      <span className="comms-opt-name">{p.name}</span>
                      <span className="comms-opt-meta">{p.phone || p.email || '—'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subject (email only) */}
        {type === 'email' && (
          <div className="comms-compose-field">
            <label>Subject</label>
            <input
              className="comms-field-input"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject…"
            />
          </div>
        )}

        {/* Message */}
        <div className="comms-compose-field">
          <label>Message</label>
          <textarea
            className="comms-field-textarea"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={type === 'sms' ? 'Type your SMS message…' : 'Type your email body…'}
            rows={5}
          />
          {type === 'sms' && <span className="comms-char-count">{content.length} / 160</span>}
        </div>

        {error && <div className="comms-compose-error">{error}</div>}

        <div className="comms-modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-send" onClick={send} disabled={mutation.isPending}>
            <Send size={13} />
            {mutation.isPending ? 'Sending…' : `Send ${type === 'sms' ? 'SMS' : 'Email'}`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function Communications() {
  const navigate = useNavigate();
  const [tab, setTab]         = useState('all');
  const [search, setSearch]   = useState('');
  const [composing, setComposing]   = useState(false);
  const [replyTo, setReplyTo]       = useState(null); // comm object to reply to

  const { data, isLoading } = useQuery({
    queryKey: ['communications', { comm_type: tab === 'all' ? undefined : tab }],
    queryFn: () => getCommunications({ comm_type: tab === 'all' ? undefined : tab, page_size: 100 }).then(r => r.data.results || r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['comm-stats'],
    queryFn: () => getCommStats().then(r => r.data),
  });

  const comms = (data || []).filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.participant?.name?.toLowerCase().includes(q) ||
      c.message?.toLowerCase().includes(q) ||
      c.content?.toLowerCase().includes(q) ||
      c.subject?.toLowerCase().includes(q)
    );
  });

  if (isLoading) return <BioLoaderPage text="Loading…" />;

  return (
    <div className="comms-page">
      {/* Header */}
      <div className="comms-page-header">
        <div>
          <h1 className="page-title">Communications</h1>
          <p className="page-sub">Unified inbox — SMS, Email, and call logs across all participants</p>
        </div>
        <button className="btn-compose" onClick={() => setComposing(true)}>
          <Plus size={15} /> Compose
        </button>
      </div>

      {/* Stats */}
      <div className="comms-stat-row">
        {[
          { label: 'Total Sent',     value: stats?.total_sent      ?? '—', icon: ArrowUpRight,  color: '#00cba8' },
          { label: 'Total Received', value: stats?.total_received  ?? '—', icon: ArrowDownLeft, color: '#7c3aed' },
          { label: 'SMS',            value: stats?.sms_count       ?? '—', icon: MessageSquare, color: '#0ea5e9' },
          { label: 'Emails',         value: stats?.email_count     ?? '—', icon: Mail,          color: '#f59e0b' },
        ].map((s, i) => (
          <motion.div key={s.label} className="comms-stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <span className="comms-stat-icon" style={{ background: `${s.color}18`, color: s.color }}><s.icon size={14} /></span>
            <div>
              <div className="comms-stat-value">{s.value}</div>
              <div className="comms-stat-label">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="comms-toolbar">
        <div className="comms-tabs">
          {TABS.map(t => (
            <button key={t.key} className={`comms-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
        <div className="comms-search-wrap">
          <Search size={13} />
          <input
            className="comms-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by participant or message…"
          />
          {search && <button className="comms-search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
        </div>
      </div>

      {/* List */}
      <div className="comms-list-wrap">
        {comms.length === 0 && (
          <div className="comms-empty">
            <Inbox size={36} />
            <div className="comms-empty-title">No communications yet</div>
            <div className="comms-empty-sub">Send an SMS or email to a participant to get started</div>
            <button className="btn-compose comms-empty-btn" onClick={() => setComposing(true)}>
              <Plus size={14} /> Compose your first message
            </button>
          </div>
        )}

        <AnimatePresence>
          {comms.map((c, i) => {
            const Icon       = TYPE_ICONS[c.comm_type] || MessageSquare;
            const isOutbound = c.direction === 'outbound';
            const status     = STATUS_META[c.status] || STATUS_META.sent;
            const StatusIcon = status.icon;
            const text       = c.content || c.message || '';

            return (
              <motion.div
                key={c.id}
                className="comm-item"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
              >
                {/* Type icon */}
                <div className={`comm-type-icon ${c.comm_type}`}><Icon size={14} /></div>

                {/* Body */}
                <div className="comm-body" onClick={() => navigate(`/participants/${c.participant?.id}`)}>
                  <div className="comm-header">
                    <span className="comm-participant">{c.participant?.name || 'Unknown'}</span>
                    <span className="comm-time">{fmtDate(c.sent_at || c.created_at)}</span>
                  </div>
                  {c.subject && <div className="comm-subject">{c.subject}</div>}
                  {text && <p className="comm-message">{text}</p>}
                  <div className="comm-meta-row">
                    <span className={`comm-direction-badge ${isOutbound ? 'out' : 'in'}`}>
                      {isOutbound ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                      {isOutbound ? 'Outbound' : 'Inbound'}
                    </span>
                    <span className="comm-dot">·</span>
                    <span className="comm-status-badge" style={{ color: status.color }}>
                      <StatusIcon size={10} /> {status.label}
                    </span>
                    <span className="comm-dot">·</span>
                    <span className="comm-agent">{c.staff?.full_name || c.staff?.username || 'System'}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="comm-actions">
                  {c.comm_type !== 'call' && (
                    <button
                      className="comm-action-btn"
                      title="Reply"
                      onClick={() => setReplyTo(c)}
                    >
                      <Reply size={13} />
                    </button>
                  )}
                  <button
                    className="comm-action-btn"
                    title="View participant"
                    onClick={() => navigate(`/participants/${c.participant?.id}`)}
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Compose / Reply modal */}
      <AnimatePresence>
        {(composing || replyTo) && (
          <ComposeModal
            key="compose"
            prefillParticipant={replyTo?.participant || null}
            prefillType={replyTo?.comm_type || null}
            onClose={() => { setComposing(false); setReplyTo(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
