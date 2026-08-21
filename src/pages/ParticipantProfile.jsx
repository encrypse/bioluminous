import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Mail, MessageSquare, Inbox, Calendar, ClipboardList,
  FilePlus, ArrowRight, UserPlus, Edit2, ChevronRight, User,
  MessageCircle, Check, Clock, AlertTriangle, Info, Sparkles,
  X, Save, MapPin, Bot, Shield, Activity, Plus, Loader2, FlaskConical,
} from 'lucide-react';
import {
  getParticipant, updateParticipant,
  getCommunications, createCommunication, getStaff,
  getTasks, createTask, updateTask,
  getBookings, createBooking,
  getStudies, createCall,
} from '../api';
import { BioLoaderPage } from '../components/ui/BioLoader';
import { humanize, humanizeText } from '../utils/humanize';
import './ParticipantProfile.css';

// ─── Config ─────────────────────────────────────────────────────
const STAGE_CONFIG = [
  { key: 'new_lead',                label: 'New Lead',                color: '#7c3aed' },
  { key: 'auto_message_sent',       label: 'Auto Message Sent',       color: '#6366f1' },
  { key: 'booking_pending',         label: 'Booking Pending',         color: '#3b82f6' },
  { key: 'pre_screening_booked',    label: 'Pre-screening Booked',    color: '#0ea5e9' },
  { key: 'booked_not_called',       label: 'Booked But Not Called',   color: '#06b6d4' },
  { key: 'called',                  label: 'Called',                  color: '#14b8a6' },
  { key: 'no_answer',               label: 'No Answer',               color: '#f59e0b' },
  { key: 'call_back_later',         label: 'Call Back Later',         color: '#d97706' },
  { key: 'pre_screening_completed', label: 'Pre-screening Completed', color: '#2a9c5c' },
  { key: 'qualified',               label: 'Qualified',               color: '#16a34a' },
  { key: 'not_qualified',           label: 'Not Qualified',           color: '#dc2626' },
  { key: 'no_show',                 label: 'No Show',                 color: '#9f1239' },
  { key: 'opted_out',               label: 'Opted Out',               color: '#6b7280' },
];
const STAGE_BY_KEY = Object.fromEntries(STAGE_CONFIG.map(s => [s.key, s]));

// ─── Helpers ─────────────────────────────────────────────────────
function fmt(d, opts = {}) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    ...opts,
  });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function commIcon(type) {
  if (type === 'sms') return <MessageSquare size={14} />;
  if (type === 'email') return <Mail size={14} />;
  return <Phone size={14} />;
}
function commColor(type) {
  if (type === 'sms') return '#0ea5e9';
  if (type === 'email') return '#8b5cf6';
  return '#2a9c5c';
}

// ─── Sub-components ──────────────────────────────────────────────
function DetailRow({ label, value, valueClass }) {
  return (
    <div className="profile-detail-row">
      <span className="profile-detail-label">{label}</span>
      <span className={`profile-detail-value ${valueClass || ''}`}>{value || '—'}</span>
    </div>
  );
}

function StageBadge({ stageKey }) {
  const s = STAGE_BY_KEY[stageKey];
  if (!s) return null;
  return (
    <span className="hero-badge" style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}40` }}>
      {s.label}
    </span>
  );
}

function ConsentBadge({ consented }) {
  return consented
    ? <span className="consent-badge consent-yes">Consented</span>
    : <span className="consent-badge consent-no">No consent</span>;
}

// ─── Modals ──────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal-panel" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }} transition={{ duration: 0.18 }}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </motion.div>
    </div>
  );
}

function NoteModal({ participantId, onClose }) {
  const [note, setNote] = useState('');
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => createCommunication({
      participant: participantId, type: 'note', direction: 'internal', body: note,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comms', participantId] }); onClose(); },
  });
  return (
    <Modal title="Add Note" onClose={onClose}>
      <div className="modal-form">
        <label className="modal-label">Note content</label>
        <textarea className="modal-textarea" rows={5} value={note} onChange={e => setNote(e.target.value)} placeholder="Write your note here…" autoFocus />
        <div className="modal-actions">
          <button className="modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn-primary" disabled={!note.trim() || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 size={14} className="spin" /> : null} Save Note
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TaskModal({ participantId, onClose }) {
  const [form, setForm] = useState({ title: '', due_date: '', type: 'callback', notes: '' });
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => createTask({ ...form, participant: participantId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', participantId] }); onClose(); },
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <Modal title="Add Task" onClose={onClose}>
      <div className="modal-form">
        <label className="modal-label">Title *</label>
        <input className="modal-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Task title" autoFocus />
        <label className="modal-label">Type</label>
        <select className="modal-input" value={form.type} onChange={e => set('type', e.target.value)}>
          <option value="callback">Callback</option>
          <option value="review">Review</option>
          <option value="alert">Alert</option>
        </select>
        <label className="modal-label">Due Date</label>
        <input className="modal-input" type="datetime-local" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        <label className="modal-label">Notes</label>
        <textarea className="modal-textarea" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
        <div className="modal-actions">
          <button className="modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn-primary" disabled={!form.title.trim() || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 size={14} className="spin" /> : null} Create Task
          </button>
        </div>
      </div>
    </Modal>
  );
}

function StageModal({ participant, onClose }) {
  const [stage, setStage] = useState(participant.stage || '');
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => updateParticipant(participant.id, { stage }),
    onSuccess: (r) => {
      qc.setQueryData(['participant', String(participant.id)], r.data);
      qc.invalidateQueries({ queryKey: ['participants'] });
      onClose();
    },
  });
  return (
    <Modal title="Change Stage" onClose={onClose}>
      <div className="modal-form">
        <label className="modal-label">Select new stage</label>
        <select className="modal-input" value={stage} onChange={e => setStage(e.target.value)}>
          {STAGE_CONFIG.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <div className="modal-actions">
          <button className="modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn-primary" disabled={mut.isPending || stage === participant.stage} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 size={14} className="spin" /> : null} Update Stage
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AssignStaffModal({ participant, staffList, onClose }) {
  const [staffId, setStaffId] = useState(participant.assigned_staff?.id || '');
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => updateParticipant(participant.id, { assigned_staff: staffId || null }),
    onSuccess: (r) => {
      qc.setQueryData(['participant', String(participant.id)], r.data);
      onClose();
    },
  });
  return (
    <Modal title="Assign Staff" onClose={onClose}>
      <div className="modal-form">
        <label className="modal-label">Select staff member</label>
        <select className="modal-input" value={staffId} onChange={e => setStaffId(e.target.value)}>
          <option value="">— Unassigned —</option>
          {staffList?.map(s => (
            <option key={s.id} value={s.id}>{s.full_name || s.username}</option>
          ))}
        </select>
        <div className="modal-actions">
          <button className="modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn-primary" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 size={14} className="spin" /> : null} Assign
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AssignStudyModal({ participant, onClose }) {
  const [studyId, setStudyId] = useState(participant.study?.id || '');
  const qc = useQueryClient();
  const { data: studiesData } = useQuery({
    queryKey: ['studies'],
    queryFn: () => getStudies({ page_size: 100 }).then(r => r.data.results ?? r.data),
  });
  const studies = studiesData || [];
  const mut = useMutation({
    mutationFn: () => updateParticipant(participant.id, { study_id: studyId || null }),
    onSuccess: (r) => {
      qc.setQueryData(['participant', String(participant.id)], r.data);
      onClose();
    },
  });
  return (
    <Modal title="Assign to Study" onClose={onClose}>
      <div className="modal-form">
        <label className="modal-label">Select study</label>
        <select className="modal-input" value={studyId} onChange={e => setStudyId(e.target.value)}>
          <option value="">— Not assigned —</option>
          {studies.map(s => (
            <option key={s.id} value={s.id}>
              {s.protocol_id} — {s.title}
            </option>
          ))}
        </select>
        <div className="modal-actions">
          <button className="modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn-primary" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 size={14} className="spin" /> : null} Assign
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditProfileModal({ participant, onClose }) {
  const [form, setForm] = useState({
    name: participant.name || '',
    phone: participant.phone || '',
    email: participant.email || '',
    postcode_city: participant.postcode_city || '',
    source: participant.source || '',
    priority: participant.priority || 'normal',
    notes: participant.notes || '',
  });
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => updateParticipant(participant.id, form),
    onSuccess: (r) => {
      qc.setQueryData(['participant', String(participant.id)], r.data);
      qc.invalidateQueries({ queryKey: ['participants'] });
      onClose();
    },
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <Modal title="Edit Profile" onClose={onClose}>
      <div className="modal-form">
        <div className="modal-grid2">
          <div>
            <label className="modal-label">Full Name *</label>
            <input className="modal-input" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className="modal-label">Phone</label>
            <input className="modal-input" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div>
            <label className="modal-label">Email</label>
            <input className="modal-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label className="modal-label">Postcode / City</label>
            <input className="modal-input" value={form.postcode_city} onChange={e => set('postcode_city', e.target.value)} />
          </div>
          <div>
            <label className="modal-label">Source</label>
            <select className="modal-input" value={form.source} onChange={e => set('source', e.target.value)}>
              <option value="">—</option>
              <option value="manual">Manual Entry</option>
              <option value="facebook">Facebook</option>
              <option value="website">Website</option>
              <option value="import">Import</option>
              <option value="referral">Referral</option>
            </select>
          </div>
          <div>
            <label className="modal-label">Priority</label>
            <select className="modal-input" value={form.priority} onChange={e => set('priority', e.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        <label className="modal-label">Notes</label>
        <textarea className="modal-textarea" rows={4} value={form.notes} onChange={e => set('notes', e.target.value)} />
        <div className="modal-actions">
          <button className="modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn-primary" disabled={!form.name.trim() || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 size={14} className="spin" /> : null} Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Timeline event ──────────────────────────────────────────────
// ── Log Call modal ─────────────────────────────────────────────────
function LogCallModal({ participant, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    outcome: 'connected',
    duration_seconds: '',
    notes: '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const callMut = useMutation({
    mutationFn: () => createCall({
      participant_id: participant.id,
      outcome: form.outcome,
      duration_seconds: form.duration_seconds ? parseInt(form.duration_seconds) * 60 : 0,
      notes: form.notes,
      direction: 'outbound',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['participant', String(participant.id)] });
      qc.invalidateQueries({ queryKey: ['calls'] });
      onClose();
    },
  });

  const commMut = useMutation({
    mutationFn: () => createCommunication({
      participant_id: participant.id,
      comm_type: 'call',
      direction: 'outbound',
      content: form.notes || `Call — ${form.outcome}`,
      status: form.outcome === 'connected' ? 'delivered' : 'sent',
    }),
  });

  function save() {
    callMut.mutate(undefined, {
      onSuccess: () => commMut.mutate(),
    });
  }

  const OUTCOMES = [
    { key: 'connected',    label: '✓ Connected' },
    { key: 'no_answer',    label: 'No Answer' },
    { key: 'voicemail',    label: 'Voicemail' },
    { key: 'missed',       label: 'Missed' },
    { key: 'failed',       label: 'Failed' },
  ];

  return (
    <Modal title="Log Call" onClose={onClose}>
      <div className="modal-form">
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          Called <strong>{participant.name}</strong> on <strong>{participant.phone}</strong>
        </p>
        <label className="modal-label">Outcome *</label>
        <div className="log-call-outcomes">
          {OUTCOMES.map(o => (
            <button
              key={o.key}
              type="button"
              className={`log-call-outcome-btn${form.outcome === o.key ? ' active' : ''}`}
              onClick={() => set('outcome', o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <label className="modal-label">Duration (minutes)</label>
        <input
          className="modal-input"
          type="number"
          min="0"
          value={form.duration_seconds}
          onChange={e => set('duration_seconds', e.target.value)}
          placeholder="e.g. 5"
        />
        <label className="modal-label">Notes / Summary</label>
        <textarea
          className="modal-textarea"
          rows={4}
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="What was discussed? Any next steps?"
          autoFocus
        />
        <div className="modal-actions">
          <button className="modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="modal-btn-primary"
            disabled={callMut.isPending || commMut.isPending}
            onClick={save}
          >
            {callMut.isPending ? <Loader2 size={14} className="spin" /> : null} Log Call
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Send SMS modal ─────────────────────────────────────────────────
function SendSmsModal({ participant, onClose }) {
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => createCommunication({
      participant_id: participant.id,
      comm_type: 'sms',
      direction: 'outbound',
      content,
      status: 'sent',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communications'] });
      qc.invalidateQueries({ queryKey: ['comms', participant.id] });
      onClose();
    },
    onError: () => setError('Failed to send. Try again.'),
  });
  return (
    <Modal title={`Send SMS to ${participant.name}`} onClose={onClose}>
      <div className="modal-form">
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          To: <strong>{participant.phone || '—'}</strong>
        </p>
        <label className="modal-label">Message</label>
        <textarea
          className="modal-textarea"
          rows={5}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Type your SMS message…"
          autoFocus
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>{content.length} / 160</span>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn-primary" disabled={!content.trim() || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 size={14} className="spin" /> : null} Send SMS
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Send Email modal ───────────────────────────────────────────────
function SendEmailModal({ participant, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ subject: '', content: '' });
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const mut = useMutation({
    mutationFn: () => createCommunication({
      participant_id: participant.id,
      comm_type: 'email',
      direction: 'outbound',
      subject: form.subject,
      content: form.content,
      status: 'sent',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communications'] });
      qc.invalidateQueries({ queryKey: ['comms', participant.id] });
      onClose();
    },
    onError: () => setError('Failed to send. Try again.'),
  });
  return (
    <Modal title={`Send Email to ${participant.name}`} onClose={onClose}>
      <div className="modal-form">
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          To: <strong>{participant.email || '—'}</strong>
        </p>
        <label className="modal-label">Subject</label>
        <input className="modal-input" value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Email subject…" autoFocus />
        <label className="modal-label">Message</label>
        <textarea className="modal-textarea" rows={6} value={form.content} onChange={e => set('content', e.target.value)} placeholder="Type your email body…" />
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn-primary" disabled={!form.subject.trim() || !form.content.trim() || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 size={14} className="spin" /> : null} Send Email
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TimelineEvent({ event }) {
  const [expanded, setExpanded] = useState(false);
  const color = event.color || '#2a9c5c';
  return (
    <div className="timeline-event">
      <div className="timeline-icon" style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}>
        {event.icon}
      </div>
      <div className="timeline-content">
        <div className="timeline-header">
          <span className="timeline-type">{event.title}</span>
          {event.badge && (
            <span className="timeline-badge" style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
              {event.badge}
            </span>
          )}
          <span className="timeline-date">{fmt(event.created_at)}</span>
        </div>
        {event.preview && <p className="timeline-preview">{event.preview}</p>}
        {event.details && (
          <>
            <button className="timeline-expand" onClick={() => setExpanded(v => !v)}>
              {expanded ? 'Hide' : 'Details'} <ChevronRight size={11} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: '150ms' }} />
            </button>
            <AnimatePresence>
              {expanded && (
                <motion.div className="timeline-details" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  {event.details}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export default function ParticipantProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Modal state
  const [modal, setModal] = useState(null); // 'note'|'task'|'stage'|'staff'|'edit'|'book'

  const { data: participant, isLoading } = useQuery({
    queryKey: ['participant', id],
    queryFn: () => getParticipant(id).then(r => r.data),
  });

  const { data: commsData } = useQuery({
    queryKey: ['comms', id],
    queryFn: () => getCommunications({ participant: id, ordering: '-created_at' }).then(r => r.data.results || r.data),
    enabled: !!id,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => getTasks({ participant: id }).then(r => r.data.results || r.data),
    enabled: !!id,
  });

  const { data: bookingsData } = useQuery({
    queryKey: ['bookings', id],
    queryFn: () => getBookings({ participant: id }).then(r => r.data.results || r.data),
    enabled: !!id,
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => getStaff().then(r => r.data.results || r.data),
  });

  if (isLoading) return <BioLoaderPage text="Loading profile…" />;

  if (!participant) return (
    <div className="profile-not-found">
      <button className="back-btn" onClick={() => navigate('/leads')}>Back to Leads</button>
      <p>Participant not found.</p>
    </div>
  );

  const p = participant;
  const stage = STAGE_BY_KEY[p.stage];
  const stageColor = stage?.color || '#2a9c5c';
  const comms = commsData || [];
  const tasks = tasksData || [];
  const bookings = bookingsData || [];
  const openTasks = tasks.filter(t => !['completed', 'dismissed'].includes(t.status));

  // Build consent map
  const consentChannels = Array.isArray(p.consent_channels) ? p.consent_channels : [];
  const consentMap = {
    SMS: consentChannels.includes('sms'),
    Email: consentChannels.includes('email'),
    Phone: consentChannels.includes('phone'),
    WhatsApp: consentChannels.includes('whatsapp'),
  };

  // Build timeline
  const timelineEvents = [];

  // Participant created event
  timelineEvents.push({
    id: 'created',
    created_at: p.created_at,
    title: 'Participant record created',
    badge: 'New Lead',
    icon: <User size={14} />,
    color: '#7c3aed',
    preview: `Added via ${humanize(p.source)}${p.created_by ? ` by ${p.created_by.full_name || p.created_by.username}` : ''}`,
  });

  // Communications
  comms.forEach(c => {
    const color = commColor(c.comm_type || c.type);
    timelineEvents.push({
      id: `comm-${c.id}`,
      created_at: c.created_at,
      title: `${humanize(c.comm_type || c.type)} ${c.direction === 'inbound' ? 'received' : 'sent'}`,
      badge: humanize(c.status),
      icon: commIcon(c.comm_type || c.type),
      color,
      preview: c.body ? c.body.slice(0, 120) + (c.body.length > 120 ? '…' : '') : null,
      details: c.body && c.body.length > 120 ? <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{c.body}</p> : null,
    });
  });

  // Bookings
  bookings.forEach(b => {
    timelineEvents.push({
      id: `booking-${b.id}`,
      created_at: b.created_at,
      title: 'Appointment booked',
      badge: humanize(b.status),
      icon: <Calendar size={14} />,
      color: '#0ea5e9',
      preview: `${humanize(b.booking_type)} · ${fmtDate(b.scheduled_at)}${b.location ? ` · ${b.location}` : ''}`,
    });
  });

  // Sort timeline newest first
  timelineEvents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Latest booking
  const latestBooking = bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  // Next action suggestion
  const nextAction = (() => {
    if (!bookings.length) return 'Send booking prompt — Participant has not booked a pre-screening call yet.';
    if (p.stage === 'no_answer') return 'Try calling again — Participant did not answer last time. Consider a different time.';
    if (p.stage === 'qualified') return 'Schedule screening visit — Participant is qualified and ready for next steps.';
    return 'Review participant status and follow up if needed.';
  })();

  return (
    <div className="profile-page">
      {/* Breadcrumb */}
      <nav className="profile-breadcrumb">
        <Link to="/leads" className="bc-link">Recruitment</Link>
        <ChevronRight size={13} className="bc-sep" />
        <Link to="/leads" className="bc-link">Leads</Link>
        <ChevronRight size={13} className="bc-sep" />
        <span className="bc-current">{p.name}</span>
      </nav>

      {/* Page header card */}
      <div className="profile-header-card">
        <div className="profile-header-left">
          <div className="profile-header-icon"><Activity size={18} /></div>
          <div>
            <h1 className="profile-header-title">Participant profile</h1>
            <p className="profile-header-sub">Complete clinical communication record, timeline, tasks, bookings and call history.</p>
          </div>
        </div>
        {(p.study || p.study_name) && (
          <span className="profile-study-badge">{p.study?.protocol_id || p.study_name}</span>
        )}
      </div>

      {/* Hero card */}
      <motion.div className="profile-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="profile-hero-main">
          <div className="profile-hero-avatar">{initials(p.name)}</div>
          <div className="profile-hero-info">
            <h2 className="profile-hero-name">{p.name}</h2>
            <div className="profile-hero-contact">
              {p.phone && <span><Phone size={12} />{p.phone}</span>}
              {p.phone && p.email && <span className="hero-dot">·</span>}
              {p.email && <span><Mail size={12} />{p.email}</span>}
            </div>
            {(p.study || p.study_name) && <div className="profile-hero-study">Study: <strong>{p.study ? `${p.study.protocol_id} — ${p.study.title}` : p.study_name}</strong></div>}
            <div className="profile-hero-badges">
              <StageBadge stageKey={p.stage} />
              <span className="hero-badge hero-priority">
                — {humanize(p.priority || 'normal')}
              </span>
            </div>
          </div>
        </div>
        <div className="profile-hero-cols">
          <div className="hero-col">
            <div className="hero-col-label">ASSIGNED STAFF</div>
            <div className="hero-col-value">{p.assigned_staff?.full_name || p.assigned_staff?.username || '—'}</div>
          </div>
          <div className="hero-col">
            <div className="hero-col-label">SOURCE</div>
            <div className="hero-col-value">{humanize(p.source)}</div>
          </div>
          <div className="hero-col">
            <div className="hero-col-label">CREATED</div>
            <div className="hero-col-value">{fmtDate(p.created_at)}</div>
          </div>
        </div>
      </motion.div>

      {/* Action bar */}
      <div className="profile-action-bar">
        <a
          href={`tel:${p.phone}`}
          className="action-btn primary"
          onClick={() => setTimeout(() => setModal('logcall'), 800)}
        >
          <Phone size={14} /> Call
        </a>
        <button className="action-btn" onClick={() => setModal('sms')}>
          <MessageSquare size={14} /> Send SMS
        </button>
        <button className="action-btn" onClick={() => setModal('email')}>
          <Mail size={14} /> Send Email
        </button>
        <button className="action-btn" onClick={() => navigate('/communications')}>
          <Inbox size={14} /> Open Inbox
        </button>
        <button className="action-btn" onClick={() => setModal('book')}>
          <Calendar size={14} /> Book
        </button>
        <button className="action-btn" onClick={() => setModal('task')}>
          <ClipboardList size={14} /> Add Task
        </button>
        <button className="action-btn" onClick={() => setModal('note')}>
          <FilePlus size={14} /> Add Note
        </button>
        <button className="action-btn" onClick={() => setModal('stage')}>
          <ArrowRight size={14} /> Change Stage
        </button>
        <button className="action-btn" onClick={() => setModal('staff')}>
          <UserPlus size={14} /> Assign Staff
        </button>
        <button className="action-btn" onClick={() => setModal('study')}>
          <FlaskConical size={14} /> Assign Study
        </button>
        <button className="action-btn" onClick={() => setModal('edit')}>
          <Edit2 size={14} /> Edit Profile
        </button>
      </div>

      {/* Three-column layout */}
      <div className="profile-layout">
        {/* Left column */}
        <div className="profile-col-left">
          {/* Participant details */}
          <div className="profile-card">
            <div className="profile-card-title"><User size={13} /> Participant Details</div>
            <DetailRow label="Name" value={p.name} />
            <DetailRow label="Phone" value={p.phone ? <span className="phone-pill">{p.phone}</span> : null} />
            <DetailRow label="Email" value={p.email} />
            <DetailRow label="Postcode / City" value={p.postcode_city} />
            <DetailRow label="Source" value={humanize(p.source)} />
            <DetailRow label="Campaign" value={p.campaign?.name} />
            <DetailRow label="Assigned Staff" value={p.assigned_staff?.full_name || p.assigned_staff?.username} />
          </div>

          {/* Facebook form answers */}
          {p.facebook_form_answers && Object.keys(p.facebook_form_answers).length > 0 && (
            <div className="profile-card">
              <div className="profile-card-title">
                <MessageCircle size={13} /> Facebook Form Answers
              </div>
              {Object.entries(p.facebook_form_answers).map(([k, v]) => (
                <DetailRow key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
              ))}
            </div>
          )}

          {/* Statuses */}
          <div className="profile-card">
            <div className="profile-card-title"><Activity size={13} /> Statuses</div>
            <DetailRow label="Current Stage" value={<StageBadge stageKey={p.stage} />} />
            <DetailRow label="Booking" value={latestBooking ? humanize(latestBooking.status) : '—'} />
            <DetailRow label="Pre-screening" value={p.stage === 'pre_screening_completed' ? 'Completed' : p.stage === 'pre_screening_booked' ? 'Booked' : '—'} />
            <DetailRow
              label="Consent"
              value={
                <span className="consent-count-badge">
                  {consentChannels.length}/4 Channels
                </span>
              }
            />
            <DetailRow label="Opt-out" value={p.opted_out ? <span className="opt-out-badge">Opted Out</span> : <span className="opt-in-badge">Active</span>} />
          </div>

          {/* Contact history */}
          <div className="profile-card">
            <div className="profile-card-title"><Clock size={13} /> Contact History</div>
            <DetailRow label="Created" value={fmtDate(p.created_at)} />
            <DetailRow label="First Contacted" value={fmtDate(p.first_contacted_at)} />
            <DetailRow label="Last Contacted" value={fmtDate(p.last_contacted_at)} />
            <DetailRow label="Booked At" value={fmtDate(p.booked_at)} />
            <DetailRow label="Last Called" value={fmtDate(p.last_called_at)} />
          </div>
        </div>

        {/* Center column — Timeline */}
        <div className="profile-col-center">
          <div className="profile-card">
            <div className="profile-card-title">
              <Clock size={13} /> Communication Timeline
              <span className="timeline-count">{timelineEvents.length} event{timelineEvents.length !== 1 ? 's' : ''}</span>
            </div>
            {timelineEvents.length === 0 ? (
              <div className="profile-empty">No communications recorded yet.</div>
            ) : (
              <div className="timeline-list">
                {timelineEvents.map(ev => <TimelineEvent key={ev.id} event={ev} />)}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="profile-col-right">
          {/* Next best action */}
          <div className="profile-card next-action-card">
            <div className="profile-card-title"><Sparkles size={13} /> Next Best Action</div>
            <p className="next-action-text">{nextAction}</p>
            <button className="next-action-btn" onClick={() => navigate('/communications')}>
              <MessageSquare size={13} /> Send message
            </button>
          </div>

          {/* Open tasks */}
          <div className="profile-card">
            <div className="profile-card-title">
              <ClipboardList size={13} /> Open Tasks
              {openTasks.length > 0 && <span className="task-count">{openTasks.length}</span>}
            </div>
            {openTasks.length === 0 ? (
              <div className="profile-empty-sm">No open tasks.</div>
            ) : (
              <div className="task-list">
                {openTasks.slice(0, 3).map(t => (
                  <div key={t.id} className="task-item">
                    <span className="task-type-dot" />
                    <div className="task-body">
                      <div className="task-title">{t.title}</div>
                      {t.due_date && <div className="task-due">Due {fmt(t.due_date)}</div>}
                    </div>
                  </div>
                ))}
                {openTasks.length > 3 && <div className="task-more">+{openTasks.length - 3} more tasks</div>}
              </div>
            )}
          </div>

          {/* Booking summary */}
          <div className="profile-card">
            <div className="profile-card-title"><Calendar size={13} /> Booking Summary</div>
            {latestBooking ? (
              <>
                <DetailRow label="Status" value={humanize(latestBooking.status)} />
                <DetailRow label="Booked At" value={fmtDate(latestBooking.created_at)} />
                <DetailRow label="Next Appointment" value={fmtDate(latestBooking.scheduled_at)} />
                <DetailRow label="Location" value={latestBooking.location} />
              </>
            ) : (
              <div className="profile-empty-sm">No bookings yet.</div>
            )}
          </div>

          {/* Latest call summary */}
          <div className="profile-card">
            <div className="profile-card-title"><Phone size={13} /> Latest Call Summary</div>
            {p.last_called_at ? (
              <>
                <DetailRow label="Last Called" value={fmtDate(p.last_called_at)} />
                <DetailRow label="Outcome" value={humanize(p.stage)} />
              </>
            ) : (
              <div className="profile-empty-sm">No calls logged yet.</div>
            )}
          </div>

          {/* Consent status */}
          <div className="profile-card">
            <div className="profile-card-title"><Shield size={13} /> Consent Status</div>
            {Object.entries(consentMap).map(([channel, consented]) => (
              <div key={channel} className="consent-row">
                <span className="consent-channel">{channel}</span>
                <ConsentBadge consented={consented} />
              </div>
            ))}
          </div>

          {/* Participant AI card */}
          <div className="profile-card ai-card">
            <div className="profile-card-title">
              <Bot size={13} /> Participant AI
              <span className="ai-review-badge">
                <AlertTriangle size={10} /> Requires human review
              </span>
            </div>
            <p className="ai-description">
              AI-generated summary based on participant communication history, stage progression, and consent data.
            </p>
            <div className="ai-safety-warning">
              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>AI summaries are assistive only. Always verify clinical information independently before making decisions. Do not rely solely on AI output for participant care.</span>
            </div>
            <button className="generate-ai-btn">
              <Sparkles size={13} /> Generate AI Summary
            </button>
          </div>

          {/* Suggested next action */}
          <div className="profile-card">
            <div className="profile-card-title">
              <Info size={13} /> Suggested Next Action
              <span className="ai-review-badge">
                <AlertTriangle size={10} /> Requires human review
              </span>
            </div>
            <div className="suggested-action-tag">info</div>
            <p className="suggested-action-text">{nextAction}</p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal === 'note'    && <NoteModal participantId={p.id} onClose={() => setModal(null)} />}
        {modal === 'task'    && <TaskModal participantId={p.id} onClose={() => setModal(null)} />}
        {modal === 'stage'   && <StageModal participant={p} onClose={() => setModal(null)} />}
        {modal === 'staff'   && <AssignStaffModal participant={p} staffList={staffData} onClose={() => setModal(null)} />}
        {modal === 'study'   && <AssignStudyModal participant={p} onClose={() => setModal(null)} />}
        {modal === 'edit'    && <EditProfileModal participant={p} onClose={() => setModal(null)} />}
        {modal === 'logcall' && <LogCallModal participant={p} onClose={() => setModal(null)} />}
        {modal === 'sms'     && <SendSmsModal participant={p} onClose={() => setModal(null)} />}
        {modal === 'email'   && <SendEmailModal participant={p} onClose={() => setModal(null)} />}
        {modal === 'book' && (
          <Modal title="Book Appointment" onClose={() => setModal(null)}>
            <div className="modal-form">
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                Booking for: <strong>{p.name}</strong>
              </p>
              <p style={{ fontSize: 12, color: '#94a3b8' }}>
                Navigate to the Bookings page to create a full appointment for this participant.
              </p>
              <div className="modal-actions">
                <button className="modal-btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button className="modal-btn-primary" onClick={() => navigate('/bookings')}>Go to Bookings</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
