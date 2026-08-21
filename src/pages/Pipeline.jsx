import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Mail, MapPin, Calendar, User, Tag, Clock, MoreHorizontal,
  Zap, X, MessageSquare, CheckSquare, ChevronRight,
  PhoneCall, MessageCircle, Send, BookOpen, UserCheck, StickyNote,
  ListTodo, Layers, Activity,
  CalendarCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getParticipants, getParticipant, getCommunications, updateParticipant, getPipelineStages } from '../api';
import { humanize } from '../utils/humanize';
import { BioLoaderPage } from '../components/ui/BioLoader';
import './Pipeline.css';

// ── Stage config ────────────────────────────────────────────────
const STAGE_CONFIG = [
  { key: 'new_lead',                label: 'New Lead',                color: '#7c3aed', light: '#ede9fe' },
  { key: 'auto_message_sent',       label: 'Auto Message Sent',       color: '#6366f1', light: '#e0e7ff' },
  { key: 'booking_pending',         label: 'Booking Pending',         color: '#3b82f6', light: '#dbeafe' },
  { key: 'pre_screening_booked',    label: 'Pre-screening Booked',    color: '#0ea5e9', light: '#e0f2fe' },
  { key: 'booked_not_called',       label: 'Booked But Not Called',   color: '#06b6d4', light: '#cffafe' },
  { key: 'called',                  label: 'Called',                  color: '#14b8a6', light: '#ccfbf1' },
  { key: 'no_answer',               label: 'No Answer',               color: '#f59e0b', light: '#fef3c7' },
  { key: 'call_back_later',         label: 'Call Back Later',         color: '#d97706', light: '#fde68a' },
  { key: 'pre_screening_completed', label: 'Pre-screening Completed', color: '#2a9c5c', light: '#dcfce7' },
  { key: 'qualified',               label: 'Qualified',               color: '#16a34a', light: '#bbf7d0' },
  { key: 'not_qualified',           label: 'Not Qualified',           color: '#dc2626', light: '#fecaca' },
  { key: 'no_show',                 label: 'No Show',                 color: '#9f1239', light: '#ffe4e6' },
  { key: 'opted_out',               label: 'Opted Out',               color: '#6b7280', light: '#f3f4f6' },
];

// All stages — used for key/label/color lookups regardless of active state
const STAGE_META        = Object.fromEntries(STAGE_CONFIG.map(s => [s.label, s]));
const STAGE_KEY_BY_LABEL = Object.fromEntries(STAGE_CONFIG.map(s => [s.label, s.key]));
const STAGE_LABEL_BY_KEY = Object.fromEntries(STAGE_CONFIG.map(s => [s.key, s.label]));

// Derive active stage config from API data; falls back to full STAGE_CONFIG
function buildActiveStageConfig(apiStages) {
  if (!apiStages || apiStages.length === 0) return STAGE_CONFIG;
  return apiStages
    .filter(s => s.is_active && !s.is_archived)
    .sort((a, b) => a.order - b.order)
    .map(s => {
      const match = STAGE_CONFIG.find(c => c.key === s.key);
      return match
        ? { ...match, label: s.name, color: s.colour || match.color }
        : { key: s.key, label: s.name, color: s.colour || '#6b7280', light: '#f3f4f6' };
    });
}

// ── Helpers ─────────────────────────────────────────────────────
function daysAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff}d ago`;
}

function getInitials(name = '') {
  return name.split(' ').map(p => p[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Context Menu ─────────────────────────────────────────────────
function ContextMenu({ lead, position, onClose, navigate }) {
  const menuRef = useRef(null);

  useEffect(() => {
    function onMouseDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [onClose]);

  // Adjust position to not overflow viewport
  const [pos, setPos] = useState(position);
  useEffect(() => {
    if (menuRef.current) {
      const { width, height } = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setPos({
        x: Math.min(position.x, vw - width - 8),
        y: Math.min(position.y, vh - height - 8),
      });
    }
  }, [position]);

  function item(icon, label, action) {
    return (
      <button
        className="ctx-item"
        onClick={() => { action(); onClose(); }}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  }

  return createPortal(
    <motion.div
      ref={menuRef}
      className="pipeline-ctx-menu"
      style={{ left: pos.x, top: pos.y }}
      initial={{ opacity: 0, scale: 0.93, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.93, y: -6 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
    >
      {item(<User size={13} />, 'View profile', () => navigate(`/participants/${lead.id}`))}

      <div className="ctx-section-header">Contact</div>
      {item(<PhoneCall size={13} />, 'Call', () => {
        if (lead.phone) window.open(`tel:${lead.phone}`);
      })}
      {item(<MessageCircle size={13} />, 'Send SMS', () => navigate('/communications', { state: { participantId: lead.id } }))}
      {item(<Mail size={13} />, 'Send email', () => {
        if (lead.email) window.open(`mailto:${lead.email}`);
      })}

      <div className="ctx-section-header">Manage</div>
      {item(<BookOpen size={13} />, 'Book pre-screening', () => navigate('/bookings'))}
      {item(<UserCheck size={13} />, 'Assign staff', () => {})}
      {item(<StickyNote size={13} />, 'Add note', () => {})}
      {item(<ListTodo size={13} />, 'Add task', () => navigate('/tasks'))}
    </motion.div>,
    document.body
  );
}

// ── Drawer Skeleton ──────────────────────────────────────────────
function DrawerSkeleton() {
  return (
    <div className="drawer-skeleton-wrap">
      <div className="drawer-header">
        <div className="skeleton drawer-skel-avatar" />
        <div style={{ flex: 1 }}>
          <div className="skeleton drawer-skel-line" style={{ width: '60%', height: 18, marginBottom: 8 }} />
          <div className="skeleton drawer-skel-line" style={{ width: '80%', height: 13 }} />
          <div className="skeleton drawer-skel-line" style={{ width: '50%', height: 13, marginTop: 4 }} />
        </div>
      </div>
      <div className="drawer-actions">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton" style={{ width: 72, height: 32, borderRadius: 8 }} />
        ))}
      </div>
      <div className="drawer-section">
        <div className="drawer-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i}>
              <div className="skeleton" style={{ width: '60%', height: 10, marginBottom: 4 }} />
              <div className="skeleton" style={{ width: '90%', height: 14 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Drawer ───────────────────────────────────────────────────────
function ParticipantDrawer({ participantId, onClose, navigate, stageConfig }) {
  const { data: raw, isLoading } = useQuery({
    queryKey: ['participant', participantId],
    queryFn: () => getParticipant(participantId).then(r => r.data),
    enabled: !!participantId,
  });

  const { data: commsRaw } = useQuery({
    queryKey: ['communications', { participant: participantId }],
    queryFn: () => getCommunications({ participant: participantId, page_size: 5 }).then(r => r.data.results || r.data),
    enabled: !!participantId,
  });

  const p = raw;
  const comms = Array.isArray(commsRaw) ? commsRaw : [];
  const resolvedConfig  = stageConfig || STAGE_CONFIG;
  const resolvedMetaMap = Object.fromEntries(resolvedConfig.map(s => [s.label, s]));
  const resolvedKeyMap  = Object.fromEntries(resolvedConfig.map(s => [s.key, s.label]));
  const stageLabel = p ? (p.stage_display || resolvedKeyMap[p.stage] || STAGE_LABEL_BY_KEY[p.stage] || p.stage) : '';
  const stageMeta  = p ? (resolvedMetaMap[stageLabel] || STAGE_META[stageLabel] || STAGE_CONFIG[0]) : STAGE_CONFIG[0];

  function commIcon(type) {
    if (!type) return <MessageSquare size={13} />;
    if (type.includes('call') || type.includes('phone')) return <Phone size={13} />;
    if (type.includes('email')) return <Mail size={13} />;
    if (type.includes('sms') || type.includes('message')) return <MessageCircle size={13} />;
    return <MessageSquare size={13} />;
  }

  const drawerContent = (
    <>
      {/* Backdrop */}
      <motion.div
        className="pipeline-drawer-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <motion.div
        className="pipeline-drawer"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* Close button */}
        <button className="drawer-close-btn" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        {isLoading || !p ? (
          <DrawerSkeleton />
        ) : (
          <>
            {/* ── Header ── */}
            <div className="drawer-header">
              <div
                className="drawer-avatar"
                style={{ background: stageMeta.color }}
              >
                {getInitials(p.name)}
              </div>
              <div className="drawer-header-info">
                <div className="drawer-name">{p.name || 'Unknown'}</div>
                <div className="drawer-meta">
                  {p.email && <span><Mail size={11} /> {p.email}</span>}
                  {p.phone && <span><Phone size={11} /> {p.phone}</span>}
                </div>
                <span
                  className="drawer-stage-badge"
                  style={{ background: stageMeta.light, color: stageMeta.color }}
                >
                  {stageLabel || p.stage}
                </span>
              </div>
            </div>

            {/* ── Action buttons ── */}
            <div className="drawer-actions">
              {p.phone && (
                <a href={`tel:${p.phone}`} className="drawer-action-btn">
                  <Phone size={12} /> Call
                </a>
              )}
              <button
                className="drawer-action-btn"
                onClick={() => navigate('/communications', { state: { participantId: p.id } })}
              >
                <MessageCircle size={12} /> SMS
              </button>
              {p.email && (
                <a href={`mailto:${p.email}`} className="drawer-action-btn">
                  <Mail size={12} /> Email
                </a>
              )}
              <button
                className="drawer-action-btn"
                onClick={() => navigate('/bookings')}
              >
                <CalendarCheck size={12} /> Book
              </button>
            </div>

            {/* ── Meta grid ── */}
            <div className="drawer-section">
              <div className="drawer-section-title">Details</div>
              <div className="drawer-grid">
                <div className="drawer-field">
                  <label><Tag size={9} /> Source</label>
                  <span>{p.source_display || humanize(p.source) || '—'}</span>
                </div>
                <div className="drawer-field">
                  <label><Zap size={9} /> Campaign</label>
                  <span>{p.campaign?.name || '—'}</span>
                </div>
                <div className="drawer-field">
                  <label><User size={9} /> Assigned</label>
                  <span>{p.assigned_staff?.full_name || p.assigned_staff?.username || 'Unassigned'}</span>
                </div>
                <div className="drawer-field">
                  <label><Calendar size={9} /> Created</label>
                  <span>{fmtDate(p.created_at)}</span>
                </div>
                <div className="drawer-field">
                  <label><Layers size={9} /> Stage</label>
                  <span>{stageLabel || '—'}</span>
                </div>
                <div className="drawer-field">
                  <label><CalendarCheck size={9} /> Booking</label>
                  <span>{p.booking_status || (p.booking ? 'Booked' : 'Not booked')}</span>
                </div>
              </div>
            </div>

            {/* ── Two-col lower section ── */}
            <div className="drawer-lower">
              {/* Left: Timeline */}
              <div className="drawer-section drawer-timeline-section">
                <div className="drawer-section-title">
                  <Activity size={10} style={{ marginRight: 4 }} />
                  Communication Timeline
                </div>

                {comms.length === 0 ? (
                  <div className="drawer-empty-state">
                    <MessageSquare size={24} />
                    <p>No communications yet</p>
                  </div>
                ) : (
                  <div className="drawer-timeline">
                    {comms.map((c, i) => (
                      <div key={c.id || i} className="drawer-timeline-item">
                        <div className="drawer-timeline-icon">
                          {commIcon(c.type || c.communication_type)}
                        </div>
                        <div className="drawer-timeline-content">
                          <div className="drawer-timeline-label">
                            {humanize(c.type || c.communication_type || 'Message')}
                            <span className="drawer-timeline-date">{daysAgo(c.created_at || c.sent_at)}</span>
                          </div>
                          {(c.message || c.body || c.notes || c.content) && (
                            <div className="drawer-timeline-preview">
                              {(c.message || c.body || c.notes || c.content || '').slice(0, 80)}
                              {(c.message || c.body || c.notes || c.content || '').length > 80 && '…'}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Sidebar cards */}
              <div className="drawer-sidebar">
                {/* Next best action */}
                {!p.booking && (
                  <div className="drawer-nba-card">
                    <div className="drawer-nba-label">Next Best Action</div>
                    <div className="drawer-nba-action">Send booking prompt</div>
                    <button
                      className="drawer-nba-btn"
                      onClick={() => navigate('/communications', { state: { participantId: p.id } })}
                    >
                      <Send size={11} /> Send message
                    </button>
                  </div>
                )}

                {/* Booking summary */}
                <div className="drawer-info-card">
                  <div className="drawer-info-card-title"><CalendarCheck size={11} /> Booking</div>
                  {p.booking ? (
                    <div className="drawer-info-rows">
                      <div className="drawer-info-row">
                        <span className="dr-label">Status</span>
                        <span className="dr-val">Booked</span>
                      </div>
                      {p.booking.date && (
                        <div className="drawer-info-row">
                          <span className="dr-label">Date</span>
                          <span className="dr-val">{fmtDate(p.booking.date)}</span>
                        </div>
                      )}
                      {p.booking.location && (
                        <div className="drawer-info-row">
                          <span className="dr-label">Location</span>
                          <span className="dr-val">{p.booking.location}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="drawer-info-empty">No booking yet</div>
                  )}
                </div>

                {/* Open tasks */}
                {p.open_tasks_count !== undefined && (
                  <div className="drawer-info-card">
                    <div className="drawer-info-card-title"><CheckSquare size={11} /> Tasks</div>
                    <div className="drawer-tasks-count">
                      <span className="drawer-tasks-num">{p.open_tasks_count}</span>
                      <span className="drawer-tasks-label">open task{p.open_tasks_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                )}

                {/* Quick link */}
                <button
                  className="drawer-view-profile-btn"
                  onClick={() => { onClose(); navigate(`/participants/${p.id}`); }}
                >
                  View full profile <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </>
  );

  return createPortal(drawerContent, document.body);
}

// ── Kanban Card ──────────────────────────────────────────────────
function KanbanCard({ lead, meta, onDragStart, onCardClick, onMenuClick }) {
  const age = daysAgo(lead.created_at);
  const assignee = lead.assigned_staff;
  const campaignName = lead.campaign?.name;

  return (
    <motion.div
      className="kcard"
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart(e); }}
      onClick={onCardClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="kcard-accent" style={{ background: meta.color }} />

      <div className="kcard-body">
        <div className="kcard-header">
          <div className="kcard-avatar" style={{ background: meta.light, color: meta.color }}>
            {lead.initials || getInitials(lead.name)}
          </div>
          <div className="kcard-name-wrap">
            <div className="kcard-name">{lead.name || 'Unknown'}</div>
            {age && <div className="kcard-age"><Clock size={9} /> {age}</div>}
          </div>

          {/* 3-dot menu button */}
          <button
            className="kcard-menu-btn"
            onClick={e => {
              e.stopPropagation();
              onMenuClick(e, lead);
            }}
            aria-label="Options"
          >
            <MoreHorizontal size={13} />
          </button>
        </div>

        <div className="kcard-contacts">
          {lead.phone && <span className="kcard-contact"><Phone size={10} /> {lead.phone}</span>}
          {lead.email && <span className="kcard-contact"><Mail size={10} /> {lead.email}</span>}
          {lead.postcode_city && <span className="kcard-contact"><MapPin size={10} /> {lead.postcode_city}</span>}
        </div>

        <div className="kcard-tags">
          {lead.source && (
            <span className="kcard-tag source">
              <Tag size={8} /> {lead.source_display || humanize(lead.source)}
            </span>
          )}
          {campaignName && (
            <span className="kcard-tag campaign">
              <Zap size={8} /> {campaignName}
            </span>
          )}
        </div>

        <div className="kcard-footer">
          {assignee ? (
            <div className="kcard-assignee">
              <div className="kcard-assignee-dot">
                {assignee.full_name?.split(' ').map(p => p[0]).join('').slice(0, 2) || assignee.username?.[0]}
              </div>
              <span>{assignee.full_name || assignee.username}</span>
            </div>
          ) : (
            <span className="kcard-unassigned">Unassigned</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Pipeline page ─────────────────────────────────────────────────
export default function Pipeline() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: stagesData } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: () => getPipelineStages().then(r => r.data),
  });
  const activeStageConfig = buildActiveStageConfig(stagesData);
  const activeStages = activeStageConfig.map(s => s.label);
  // Dynamic lookup maps built from API-resolved config
  const metaByLabel   = Object.fromEntries(activeStageConfig.map(s => [s.label, s]));
  const keyByLabel    = Object.fromEntries(activeStageConfig.map(s => [s.label, s.key]));
  const labelByKey    = Object.fromEntries(activeStageConfig.map(s => [s.key, s.label]));

  const [draggingId, setDraggingId]         = useState(null);
  const [draggingStage, setDraggingStage]   = useState(null);
  const [drawerParticipant, setDrawerParticipant] = useState(null); // id
  const [menuState, setMenuState]           = useState(null); // { lead, x, y }

  const { data, isLoading } = useQuery({
    queryKey: ['participants', { page_size: 200 }],
    queryFn: () => getParticipants({ page_size: 200 }).then(r => r.data.results || r.data),
  });

  const mutation = useMutation({
    mutationFn: ({ id, stage }) => updateParticipant(id, { stage: keyByLabel[stage] || STAGE_KEY_BY_LABEL[stage] || stage }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['participants'] }),
    onError: (err) => console.error('Stage update failed:', err?.response?.data || err.message),
  });

  const leads = data || [];
  const total = leads.length;

  const byStage = activeStages.reduce((acc, label) => {
    acc[label] = leads.filter(l => {
      const display = l.stage_display || labelByKey[l.stage] || STAGE_LABEL_BY_KEY[l.stage] || l.stage;
      return display === label;
    });
    return acc;
  }, {});

  const handleDrop = (e, toStage) => {
    e.preventDefault();
    e.currentTarget.classList.remove('col-drag-over');
    const id = e.dataTransfer.getData('lead-id');
    if (id && draggingStage !== toStage) {
      mutation.mutate({ id, stage: toStage });
    }
    setDraggingId(null);
    setDraggingStage(null);
  };

  const openMenu = useCallback((e, lead) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuState({ lead, x: rect.right + 4, y: rect.bottom - 8 });
  }, []);

  const closeMenu = useCallback(() => setMenuState(null), []);

  if (isLoading) return <BioLoaderPage text="Loading…" />;

  return (
    <div className="pipeline-page">
      {/* Header */}
      <div className="pipeline-header">
        <div>
          <h1 className="page-title">Pipeline</h1>
          <p className="page-sub">
            {total} participants across {activeStages.length} stages · Drag cards between columns to move
          </p>
        </div>
      </div>

      {/* Board */}
      <div className="kanban-board">
        {activeStages.map((stage) => {
          const meta = metaByLabel[stage] || STAGE_CONFIG[0];
          const cols = byStage[stage] || [];
          return (
            <div
              key={stage}
              className="kanban-col"
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('col-drag-over'); }}
              onDragLeave={e => { e.currentTarget.classList.remove('col-drag-over'); }}
              onDrop={e => handleDrop(e, stage)}
            >
              <div className="col-header" style={{ borderTopColor: meta.color }}>
                <div className="col-header-left">
                  <span className="col-title" style={{ color: meta.color }}>{stage}</span>
                  <span className="col-count" style={{ background: meta.light, color: meta.color }}>
                    {cols.length}
                  </span>
                </div>
              </div>

              <div className="col-cards">
                {isLoading && stage === 'New Lead' && Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="kcard-skeleton skeleton" />
                ))}

                <AnimatePresence>
                  {cols.map((lead) => (
                    <KanbanCard
                      key={lead.id}
                      lead={lead}
                      meta={meta}
                      onCardClick={() => setDrawerParticipant(lead.id)}
                      onMenuClick={openMenu}
                      onDragStart={e => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('lead-id', String(lead.id));
                        setDraggingId(lead.id);
                        setDraggingStage(stage);
                      }}
                    />
                  ))}
                </AnimatePresence>

                {!isLoading && cols.length === 0 && (
                  <div className="col-empty">
                    <div className="col-empty-icon" style={{ borderColor: meta.color, color: meta.color }}>+</div>
                    <span>Drop here</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {menuState && (
          <ContextMenu
            key="ctx-menu"
            lead={menuState.lead}
            position={{ x: menuState.x, y: menuState.y }}
            onClose={closeMenu}
            navigate={navigate}
          />
        )}
      </AnimatePresence>

      {/* Slide-in Drawer */}
      <AnimatePresence>
        {drawerParticipant && (
          <ParticipantDrawer
            key="drawer"
            participantId={drawerParticipant}
            onClose={() => setDrawerParticipant(null)}
            navigate={navigate}
            stageConfig={activeStageConfig}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
