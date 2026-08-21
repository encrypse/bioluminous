import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { getStudies, createStudy, getResearchStats, getParticipants } from '../api';
import { BioLoaderPage } from '../components/ui/BioLoader';
import {
  FlaskConical, Plus, X, Users, Calendar, CheckCircle, Clock,
  AlertCircle, ChevronRight, Activity, FileText, Target,
  TrendingUp, Shield, Award, Microscope, Search, BarChart2,
  BookOpen, Layers, UserCheck, XCircle, PauseCircle
} from 'lucide-react';
import './Studies.css';

const PHASE_META = {
  phase_1:      { label: 'Phase I',       color: '#7c3aed', bg: '#f3f0ff' },
  phase_2:      { label: 'Phase II',      color: '#3b82f6', bg: '#eff6ff' },
  phase_3:      { label: 'Phase III',     color: '#0ea5e9', bg: '#e0f2fe' },
  phase_4:      { label: 'Phase IV',      color: '#14b8a6', bg: '#ccfbf1' },
  observational:{ label: 'Observational', color: '#6366f1', bg: '#e0e7ff' },
  expanded:     { label: 'Expanded Access', color: '#8b5cf6', bg: '#f5f3ff' },
};

const STATUS_META = {
  planning:   { label: 'Planning',   color: '#6b7280', bg: '#f3f4f6',  icon: Clock },
  recruiting: { label: 'Recruiting', color: '#2a9c5c', bg: '#dcfce7',  icon: UserCheck },
  active:     { label: 'Active',     color: '#3b82f6', bg: '#eff6ff',  icon: Activity },
  paused:     { label: 'Paused',     color: '#d97706', bg: '#fef3c7',  icon: PauseCircle },
  completed:  { label: 'Completed',  color: '#16a34a', bg: '#bbf7d0',  icon: CheckCircle },
  closed:     { label: 'Closed',     color: '#9f1239', bg: '#fff1f2',  icon: XCircle },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Studies() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: studiesData, isLoading } = useQuery({
    queryKey: ['studies', { status: statusFilter !== 'all' ? statusFilter : undefined, phase: phaseFilter !== 'all' ? phaseFilter : undefined }],
    queryFn: () => getStudies({ status: statusFilter !== 'all' ? statusFilter : undefined, phase: phaseFilter !== 'all' ? phaseFilter : undefined }).then(r => r.data.results || r.data),
  });

  const { data: statsData } = useQuery({
    queryKey: ['research-stats'],
    queryFn: () => getResearchStats().then(r => r.data),
  });

  const studies = studiesData || [];

  const filtered = studies.filter(s => {
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchPhase = phaseFilter === 'all' || s.phase === phaseFilter;
    const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase()) || (s.id || s.protocol_id || '').toLowerCase().includes(search.toLowerCase()) || s.pi?.toLowerCase().includes(search.toLowerCase()) || s.principal_investigator?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchPhase && matchSearch;
  });

  const totalParticipants = statsData?.total_enrolled || studies.reduce((s, st) => s + (st.current_enrollment || 0), 0);
  const activeStudies = statsData?.recruiting + statsData?.active || studies.filter(s => ['recruiting', 'active'].includes(s.status)).length;
  const completedStudies = statsData?.completed || studies.filter(s => s.status === 'completed').length;

  if (isLoading) return <BioLoaderPage text="Loading…" />;

  return (
    <div className="studies-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clinical Studies</h1>
          <p className="page-sub">{studies.length} studies · {totalParticipants} enrolled participants</p>
        </div>
        <button className="btn-primary-sm" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> New Study
        </button>
      </div>

      {/* KPI */}
      <div className="studies-kpi">
        {[
          { label: 'Total Studies',       value: studies.length,      color: '#6366f1', icon: FlaskConical },
          { label: 'Actively Recruiting', value: activeStudies,       color: '#2a9c5c', icon: UserCheck },
          { label: 'Completed',           value: completedStudies,    color: '#16a34a', icon: CheckCircle },
          { label: 'Total Enrolled',      value: totalParticipants,   color: '#0ea5e9', icon: Users },
        ].map((k, i) => (
          <motion.div key={k.label} className="studies-kpi-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <div className="studies-kpi-icon" style={{ background: `${k.color}18`, color: k.color }}><k.icon size={18} /></div>
            <div>
              <div className="studies-kpi-value">{k.value}</div>
              <div className="studies-kpi-label">{k.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="studies-filters-bar">
        <div className="billing-search" style={{ maxWidth: 320 }}>
          <Search size={14} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search studies, PI, protocol…" />
        </div>
        <div className="studies-filter-group">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)}>
            <option value="all">All Phases</option>
            {Object.entries(PHASE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* Study Cards Grid */}
      <div className="studies-grid">
        {filtered.map((study, i) => {
          const sm = STATUS_META[study.status] || STATUS_META.planning;
          const pm = PHASE_META[study.phase] || PHASE_META.observational;
          const pct = study.target_enrollment > 0 ? Math.min(100, Math.round((study.current_enrollment / study.target_enrollment) * 100)) : 0;
          const StatusIcon = sm.icon;

          return (
            <motion.div
              key={study.id}
              className="study-card"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => setSelected(study)}
            >
              <div className="study-card-header">
                <div className="study-id-row">
                  <span className="study-id">{study.protocol_id}</span>
                  <div className="study-badges">
                    <span className="study-phase-badge" style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
                    <span className="study-status-badge" style={{ background: sm.bg, color: sm.color }}>
                      <StatusIcon size={10} /> {sm.label}
                    </span>
                  </div>
                </div>
                <h3 className="study-title">{study.title}</h3>
                <p className="study-sponsor"><Building2 size={11} /> {study.sponsor}</p>
              </div>

              <div className="study-card-body">
                <p className="study-desc">{study.description}</p>

                {/* Enrollment bar */}
                <div className="study-enrollment">
                  <div className="enrollment-header">
                    <span className="enrollment-label"><Users size={11} /> Enrollment</span>
                    <span className="enrollment-count">{study.current_enrollment} / {study.target_enrollment}</span>
                  </div>
                  <div className="enrollment-bar">
                    <motion.div
                      className="enrollment-fill"
                      style={{ background: sm.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.3 + i * 0.06, duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="enrollment-pct">{pct}% complete</div>
                </div>

                {/* Meta */}
                <div className="study-meta-grid">
                  <div className="study-meta-item">
                    <span className="meta-label">PI</span>
                    <span className="meta-value">{study.principal_investigator}</span>
                  </div>
                  <div className="study-meta-item">
                    <span className="meta-label">Ethics</span>
                    <span className="meta-value">{study.ethics_number}</span>
                  </div>
                  <div className="study-meta-item">
                    <span className="meta-label">Start</span>
                    <span className="meta-value">{fmtDate(study.start_date)}</span>
                  </div>
                  <div className="study-meta-item">
                    <span className="meta-label">End</span>
                    <span className="meta-value">{fmtDate(study.end_date)}</span>
                  </div>
                </div>

                {/* Tags */}
                <div className="study-tags">
                  {study.tags?.map(t => <span key={t} className="study-tag">{t}</span>)}
                </div>
              </div>

              <div className="study-card-footer">
                <span className="study-sites">{study.sites?.length} site{study.sites?.length !== 1 ? 's' : ''}</span>
                <button className="study-view-btn">View Details <ChevronRight size={13} /></button>
              </div>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <div className="studies-empty">
            <FlaskConical size={40} style={{ color: 'var(--primary)', opacity: 0.3, marginBottom: 12 }} />
            {studies.length === 0
              ? <><p>No studies yet.</p><p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Create your first study to get started.</p></>
              : <p>No studies match your current filters.</p>
            }
          </div>
        )}
      </div>

      {/* Study Detail Drawer */}
      <AnimatePresence>
        {selected && <StudyDetail study={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && <CreateStudyModal onClose={() => setShowCreate(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ['studies'] }); qc.invalidateQueries({ queryKey: ['research-stats'] }); setShowCreate(false); }} />}
      </AnimatePresence>
    </div>
  );
}

function Building2({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>
    </svg>
  );
}

function StudyDetail({ study, onClose }) {
  const sm = STATUS_META[study.status] || STATUS_META.planning;
  const pm = PHASE_META[study.phase] || PHASE_META.observational;
  const StatusIcon = sm.icon;
  const pct = study.target_enrollment > 0 ? Math.min(100, Math.round((study.current_enrollment / study.target_enrollment) * 100)) : 0;
  const doneMilestones = study.milestones?.filter(m => m.done).length || 0;

  const { data: enrolledData } = useQuery({
    queryKey: ['participants', { study: study.id }],
    queryFn: () => getParticipants({ study: study.id, page_size: 50 }).then(r => r.data.results ?? r.data),
  });
  const enrolled = enrolledData || [];

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="study-detail-modal" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }} transition={{ type: 'spring', damping: 26, stiffness: 280 }} onClick={e => e.stopPropagation()}>

        <div className="study-detail-header">
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span className="study-phase-badge" style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
              <span className="study-status-badge" style={{ background: sm.bg, color: sm.color }}><StatusIcon size={10} /> {sm.label}</span>
              <span className="study-id">{study.protocol_id}</span>
            </div>
            <h2 className="study-detail-title">{study.title}</h2>
            <div className="study-detail-sponsor"><Building2 size={12} /> {study.sponsor}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="study-detail-body">
          <p className="study-detail-desc">{study.description}</p>

          {/* Enrollment */}
          <div className="detail-section">
            <h4 className="detail-section-title"><Users size={13} /> Enrollment Progress</h4>
            <div className="study-enrollment-lg">
              <div className="enrollment-bar-lg">
                <motion.div className="enrollment-fill" style={{ background: sm.color, width: `${pct}%` }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{study.current_enrollment} enrolled</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Target: {study.target_enrollment} · {pct}%</span>
              </div>
            </div>
          </div>

          {/* Enrolled Participants */}
          <div className="detail-section">
            <h4 className="detail-section-title"><UserCheck size={13} /> Enrolled Participants ({enrolled.length})</h4>
            {enrolled.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                No participants assigned to this study yet. Use the participant profile to assign leads.
              </p>
            ) : (
              <div className="study-participants-list">
                {enrolled.map(p => (
                  <div key={p.id} className="study-participant-row">
                    <div className="study-participant-avatar">
                      {(p.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="study-participant-info">
                      <div className="study-participant-name">{p.name}</div>
                      <div className="study-participant-meta">{p.phone || p.email || '—'}</div>
                    </div>
                    <span className="study-participant-stage">{p.stage_display || p.stage}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Grid */}
          <div className="detail-section">
            <h4 className="detail-section-title"><FileText size={13} /> Study Information</h4>
            <div className="study-info-grid">
              {[
                { label: 'Principal Investigator', value: study.principal_investigator },
                { label: 'Ethics / REC Number', value: study.ethics_number },
                { label: 'Start Date', value: fmtDate(study.start_date) },
                { label: 'End Date', value: fmtDate(study.end_date) },
                { label: 'Study Sites', value: study.sites?.join(', ') },
                { label: 'Sponsor', value: study.sponsor },
              ].map(f => (
                <div key={f.label} className="study-info-field">
                  <div className="info-label">{f.label}</div>
                  <div className="info-value">{f.value || '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Milestones */}
          {study.milestones?.length > 0 && (
            <div className="detail-section">
              <h4 className="detail-section-title"><Target size={13} /> Milestones ({doneMilestones}/{study.milestones.length})</h4>
              <div className="milestones-list">
                {study.milestones.map((m, i) => (
                  <div key={i} className={`milestone-item ${m.done ? 'done' : ''}`}>
                    <div className={`milestone-dot ${m.done ? 'done' : ''}`}>
                      {m.done ? <CheckCircle size={14} /> : <div className="milestone-empty-dot" />}
                    </div>
                    <div className="milestone-body">
                      <span className="milestone-label">{m.label}</span>
                      <span className="milestone-date">{fmtDate(m.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function generateProtocolId(phase, title) {
  const phaseCode = { phase_1: 'P1', phase_2: 'P2', phase_3: 'P3', phase_4: 'P4', observational: 'OB', expanded: 'EA' }[phase] || 'P2';
  const words = title.trim().split(/\s+/).filter(Boolean);
  const abbr = words.length >= 2
    ? (words[0].slice(0, 3) + words[1].slice(0, 3)).toUpperCase()
    : (words[0] || 'STD').slice(0, 6).toUpperCase();
  const num = String(Math.floor(Math.random() * 900) + 100);
  const year = new Date().getFullYear();
  return `BIO-${abbr}-${phaseCode}-${year}-${num}`;
}

function CreateStudyModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: '', protocol_id: '', sponsor: '', phase: 'phase_2', status: 'planning',
    principal_investigator: '', ethics_number: '', target_enrollment: '', start_date: '', end_date: '', description: '',
  });
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function handleGenerateProtocolId() {
    set('protocol_id', generateProtocolId(form.phase, form.title));
  }

  const mutation = useMutation({
    mutationFn: createStudy,
    onSuccess,
    onError: (err) => setErrors(err.response?.data || { detail: 'Failed to create study' }),
  });

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="billing-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
        <div className="billing-modal-header">
          <div><h2>New Clinical Study</h2><p>Register a new clinical research study</p></div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="billing-modal-body">
          {errors.detail && <div className="form-error-banner" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>{errors.detail}</div>}
          <div className="billing-form-section">
            <h4 className="billing-section-title"><FlaskConical size={13} /> Study Identity</h4>
            <div className="billing-form-grid-3">
              <div className="edit-field" style={{ gridColumn: '1 / 3' }}>
                <label>Study Title *</label>
                <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Full title of the clinical study…" />
              </div>
              <div className="edit-field">
                <label>Protocol ID *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={form.protocol_id}
                    onChange={e => set('protocol_id', e.target.value)}
                    placeholder="BIO-XXXX-001"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleGenerateProtocolId}
                    title="Auto-generate Protocol ID"
                    style={{
                      flexShrink: 0, padding: '0 10px', borderRadius: 7,
                      border: '1px solid #d1fae5', background: '#f0fdf9',
                      color: '#0a7c68', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.03em',
                      transition: 'background 0.15s',
                    }}
                    onMouseOver={e => e.currentTarget.style.background = '#d1fae5'}
                    onMouseOut={e => e.currentTarget.style.background = '#f0fdf9'}
                  >
                    ✦ Generate
                  </button>
                </div>
              </div>
            </div>
            <div className="billing-form-grid-3">
              <div className="edit-field">
                <label>Phase</label>
                <select value={form.phase} onChange={e => set('phase', e.target.value)}>
                  {Object.entries(PHASE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="edit-field">
                <label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="edit-field">
                <label>Target Enrollment</label>
                <input type="number" min={1} value={form.target_enrollment} onChange={e => set('target_enrollment', e.target.value)} placeholder="e.g. 120" />
              </div>
            </div>
          </div>
          <div className="billing-form-section">
            <h4 className="billing-section-title"><Shield size={13} /> Governance & Personnel</h4>
            <div className="billing-form-grid-3">
              <div className="edit-field">
                <label>Principal Investigator</label>
                <input value={form.principal_investigator} onChange={e => set('principal_investigator', e.target.value)} placeholder="Dr. / Prof. …" />
              </div>
              <div className="edit-field">
                <label>Sponsor</label>
                <input value={form.sponsor} onChange={e => set('sponsor', e.target.value)} placeholder="Sponsoring organisation" />
              </div>
              <div className="edit-field">
                <label>Ethics / REC Number</label>
                <input value={form.ethics_number} onChange={e => set('ethics_number', e.target.value)} placeholder="REC/YYYY/XXXX" />
              </div>
            </div>
            <div className="billing-form-grid-3">
              <div className="edit-field">
                <label>Start Date</label>
                <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
              </div>
              <div className="edit-field">
                <label>End Date</label>
                <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="billing-form-section">
            <h4 className="billing-section-title">Study Description</h4>
            <textarea rows={4} className="billing-notes" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Protocol summary, objectives, and methodology…" />
          </div>
        </div>
        <div className="billing-modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.title || !form.protocol_id}>
            {mutation.isPending ? 'Registering…' : <><FlaskConical size={14} /> Register Study</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
