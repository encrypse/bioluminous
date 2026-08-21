import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, ChevronDown, Phone, LayoutList, LayoutGrid,
  Download, Upload, Plus, MoreHorizontal, User, ExternalLink,
  Trash2, Edit3, ArrowDown, Calendar, Clock, X, CheckSquare, Square,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getParticipants, deleteParticipant, getStaff, getCampaigns } from '../api';
import { humanize } from '../utils/humanize';
import { BioLoaderPage } from '../components/ui/BioLoader';
import AddLeadModal from '../components/crm/AddLeadModal';
import './Leads.css';

// ─── Stage config ────────────────────────────────────────────────────────────
const STAGE_CONFIG = [
  { key: 'new_lead',                label: 'New Lead',                color: '#7c3aed' },
  { key: 'auto_message_sent',       label: 'Auto Message Sent',       color: '#6366f1' },
  { key: 'booking_pending',         label: 'Booking Pending',         color: '#f59e0b' },
  { key: 'pre_screening_booked',    label: 'Pre-screening Booked',    color: '#10b981' },
  { key: 'booked_not_called',       label: 'Booked But Not Called',   color: '#ef4444' },
  { key: 'called',                  label: 'Called',                  color: '#1d4ed8' },
  { key: 'no_answer',               label: 'No Answer',               color: '#d97706' },
  { key: 'call_back_later',         label: 'Call Back Later',         color: '#b45309' },
  { key: 'pre_screening_completed', label: 'Pre-screening Completed', color: '#059669' },
  { key: 'qualified',               label: 'Qualified',               color: '#16a34a' },
  { key: 'not_qualified',           label: 'Not Qualified',           color: '#dc2626' },
  { key: 'no_show',                 label: 'No Show',                 color: '#9f1239' },
  { key: 'opted_out',               label: 'Opted Out',               color: '#6b7280' },
];
const STAGE_MAP = Object.fromEntries(STAGE_CONFIG.map(s => [s.key, s]));

const SOURCE_LABELS = {
  manual: 'Manual', facebook: 'Facebook', website: 'Website',
  import: 'Import', referral: 'Referral',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isCalled(lead) {
  return (lead.call_status && lead.call_status !== 'not_called') ||
    (lead.calls_count != null && lead.calls_count > 0) ||
    !!lead.last_call;
}

function isBooked(lead) {
  return (lead.booking_status && lead.booking_status !== 'not_booked') ||
    !!lead.booking ||
    (lead.bookings_count != null && lead.bookings_count > 0);
}

function relativeTime(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function AvatarXS({ name, size = 28 }) {
  return (
    <div className="avatar-xs" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {getInitials(name || '?')}
    </div>
  );
}

function StageBadge({ stageKey, label }) {
  const cfg = STAGE_MAP[stageKey];
  const color = cfg?.color || '#6b7280';
  const displayLabel = label || cfg?.label || humanize(stageKey);
  return (
    <span className="stage-badge" style={{ '--dot-color': color }}>
      <span className="stage-dot" style={{ background: color }} />
      {displayLabel}
    </span>
  );
}

function StatusPill({ active, activeLabel, inactiveLabel, activeClass, inactiveClass }) {
  return (
    <span className={`status-pill ${active ? activeClass : inactiveClass}`}>
      <span className="pill-dot" />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

function RowMenu({ lead, onDelete, onEdit }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handle = (fn) => (e) => {
    e.stopPropagation();
    setOpen(false);
    fn();
  };

  return (
    <div className="row-menu-wrap" onClick={e => e.stopPropagation()}>
      <button
        className="row-menu-trigger"
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        title="Actions"
      >
        <MoreHorizontal size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="row-menu-overlay" onClick={() => setOpen(false)} />
            <motion.div
              className="row-menu-dropdown"
              initial={{ opacity: 0, scale: 0.92, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -4 }}
              transition={{ duration: 0.12 }}
            >
              <button className="row-menu-item" onClick={handle(() => navigate(`/participants/${lead.id}`))}>
                <ExternalLink size={13} /> View Profile
              </button>
              <button className="row-menu-item" onClick={handle(() => onEdit && onEdit(lead))}>
                <Edit3 size={13} /> Edit
              </button>
              <div className="row-menu-divider" />
              <button className="row-menu-item danger" onClick={handle(() => onDelete(lead.id))}>
                <Trash2 size={13} /> Delete
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Grid Card ────────────────────────────────────────────────────────────────
function LeadCard({ lead, onDelete, onSelect, selected, i }) {
  const navigate = useNavigate();
  const called = isCalled(lead);
  const booked = isBooked(lead);

  return (
    <motion.div
      className={`lead-card ${selected ? 'selected' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04, duration: 0.2 }}
      onClick={() => navigate(`/participants/${lead.id}`)}
    >
      <div className="lead-card-header">
        <div className="avatar-cell" style={{ gap: 10 }}>
          <AvatarXS name={lead.name} size={36} />
          <div style={{ minWidth: 0 }}>
            <div className="lead-name">{lead.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email || '—'}</div>
          </div>
        </div>
        <RowMenu lead={lead} onDelete={onDelete} />
      </div>
      <div className="lead-card-body">
        <div className="lead-card-row">
          <span className="lc-label">Stage</span>
          <StageBadge stageKey={lead.stage} label={lead.stage_display} />
        </div>
        <div className="lead-card-row">
          <span className="lc-label">Phone</span>
          <span className={`phone-badge ${called ? 'called' : ''}`}>{lead.phone || '—'}</span>
        </div>
        <div className="lead-card-row">
          <span className="lc-label">Source</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {SOURCE_LABELS[lead.source] || humanize(lead.source) || '—'}
          </span>
        </div>
        <div className="lead-card-row">
          <span className="lc-label">Booking</span>
          <StatusPill
            active={booked}
            activeLabel="Booked"
            inactiveLabel="Not booked"
            activeClass="pill-green"
            inactiveClass="pill-gray"
          />
        </div>
      </div>
      <div className="lead-card-footer">
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          <Clock size={10} style={{ display: 'inline', marginRight: 3 }} />
          {relativeTime(lead.last_contacted || lead.updated_at || lead.created_at)}
        </span>
        {lead.assigned_staff && (
          <div className="avatar-cell" style={{ gap: 5 }}>
            <AvatarXS name={lead.assigned_staff.full_name || lead.assigned_staff.username} size={20} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {(lead.assigned_staff.full_name || lead.assigned_staff.username || '').split(' ')[0]}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Leads() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const importRef = useRef();

  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [source, setSource] = useState('');
  const [assignedStaff, setAssignedStaff] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState('table');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [openSortMenu, setOpenSortMenu] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['participants', { search, stage, source, assignedStaff, dateFrom, dateTo, page }],
    queryFn: () => getParticipants({
      search,
      stage: stage || undefined,
      source: source || undefined,
      assigned_staff: assignedStaff || undefined,
      created_after: dateFrom || undefined,
      created_before: dateTo || undefined,
      page,
      page_size: 20,
    }).then(r => r.data),
    keepPreviousData: true,
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => getStaff().then(r => r.data.results || r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => deleteParticipant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['participants'] }),
  });

  let leads = data?.results || data || [];
  const total = data?.count || leads.length;
  const pageCount = Math.ceil(total / 20);

  // Client-side sort (server handles real pagination; this is display-only for current page)
  leads = [...leads].sort((a, b) => {
    if (sort === 'name_asc') return (a.name || '').localeCompare(b.name || '');
    if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
    return new Date(b.created_at) - new Date(a.created_at); // newest
  });

  const allIds = leads.map(l => l.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDelete = useCallback((id) => {
    if (window.confirm('Delete this lead? This cannot be undone.')) {
      deleteMut.mutate(id);
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }, [deleteMut]);

  const SORT_OPTIONS = [
    { key: 'newest', label: 'Newest first' },
    { key: 'oldest', label: 'Oldest first' },
    { key: 'name_asc', label: 'Name A–Z' },
  ];
  const sortLabel = SORT_OPTIONS.find(s => s.key === sort)?.label || 'Newest first';

  const activeFilters = [stage, source, assignedStaff, dateFrom, dateTo].filter(Boolean).length;

  if (isLoading) return <BioLoaderPage text="Loading…" />;

  return (
    <div className="leads-page">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="leads-breadcrumb">Recruitment <span>/</span> Leads</div>
          <h1 className="page-title">Leads</h1>
          <p className="page-sub">Search, filter and manage every participant from enquiry to pre-screening.</p>
        </div>
        <div className="header-actions">
          <button className="btn-outline" onClick={() => alert('Import not yet implemented.')}>
            <Upload size={14} /> Import
          </button>
          <button className="btn-outline" onClick={() => {
            const rows = leads.map(l => ({
              Name: l.name || `${l.first_name || ''} ${l.last_name || ''}`.trim(),
              Email: l.email || '',
              Phone: l.phone || '',
              Stage: l.stage || '',
              Source: l.source || '',
              'Assigned Staff': l.assigned_staff?.full_name || '',
              'Created At': l.created_at ? new Date(l.created_at).toLocaleDateString('en-GB') : '',
            }));
            const headers = Object.keys(rows[0] || {});
            const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
            URL.revokeObjectURL(url);
          }}>
            <Download size={14} /> Export
          </button>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> Add Lead
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="leads-toolbar">
        <div className="leads-search">
          <Search size={14} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, phone, email or postcode..."
          />
          {search && (
            <button className="search-clear" onClick={() => { setSearch(''); setPage(1); }}>
              <X size={12} />
            </button>
          )}
        </div>

        <button
          className={`leads-filter-btn ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(v => !v)}
        >
          <Filter size={14} />
          Filters
          {activeFilters > 0 && <span className="filter-badge">{activeFilters}</span>}
          <ChevronDown size={12} className={showFilters ? 'rotated' : ''} />
        </button>

        {/* Sort dropdown */}
        <div className="sort-wrap">
          <button className="sort-btn" onClick={() => setOpenSortMenu(v => !v)}>
            {sortLabel} <ChevronDown size={12} />
          </button>
          <AnimatePresence>
            {openSortMenu && (
              <>
                <div className="sort-overlay" onClick={() => setOpenSortMenu(false)} />
                <motion.div
                  className="sort-dropdown"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
                >
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      className={`sort-option ${sort === opt.key ? 'active' : ''}`}
                      onClick={() => { setSort(opt.key); setOpenSortMenu(false); }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="toolbar-spacer" />

        {/* View toggle */}
        <div className="view-toggle">
          <button
            className={view === 'table' ? 'active' : ''}
            onClick={() => setView('table')}
            title="Table view"
          >
            <LayoutList size={14} />
          </button>
          <button
            className={view === 'grid' ? 'active' : ''}
            onClick={() => setView('grid')}
            title="Grid view"
          >
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {/* ── Filter Row ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            className="leads-filter-row"
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="filter-group">
              <label>Stage</label>
              <select value={stage} onChange={e => { setStage(e.target.value); setPage(1); }}>
                <option value="">All stages</option>
                {STAGE_CONFIG.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Source</label>
              <select value={source} onChange={e => { setSource(e.target.value); setPage(1); }}>
                <option value="">All sources</option>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Assigned To</label>
              <select value={assignedStaff} onChange={e => { setAssignedStaff(e.target.value); setPage(1); }}>
                <option value="">Anyone</option>
                {(staffData || []).map(s => (
                  <option key={s.id} value={s.id}>{s.full_name || s.username}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>From</label>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
            </div>
            <div className="filter-group">
              <label>To</label>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
            </div>
            {activeFilters > 0 && (
              <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                <label>&nbsp;</label>
                <button className="clear-filters-btn" onClick={() => {
                  setStage(''); setSource(''); setAssignedStaff('');
                  setDateFrom(''); setDateTo(''); setPage(1);
                }}>
                  <X size={12} /> Clear filters
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Count row ── */}
      <div className="leads-count">
        {isLoading
          ? 'Loading…'
          : `Showing ${leads.length} of ${total} lead${total !== 1 ? 's' : ''}`
        }
        {selected.size > 0 && (
          <span className="selection-info"> · {selected.size} selected</span>
        )}
      </div>

      {/* ── TABLE VIEW ── */}
      {view === 'table' && (
        <div className="leads-table-wrap">
          <table className="leads-table">
            <thead>
              <tr>
                <th className="th-check">
                  <button className="checkbox-btn" onClick={toggleAll} title={allSelected ? 'Deselect all' : 'Select all'}>
                    {allSelected
                      ? <CheckSquare size={14} className="cb-checked" />
                      : <Square size={14} className="cb-empty" />
                    }
                  </button>
                </th>
                <th>Participant</th>
                <th>Received</th>
                <th>Phone</th>
                <th>Source</th>
                <th>Campaign</th>
                <th>Stage</th>
                <th>Assigned</th>
                <th>Booking</th>
                <th>Call</th>
                <th>Last Contacted</th>
                <th className="th-actions"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="skeleton-row">
                  {Array.from({ length: 12 }).map((__, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 14, borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))}

              {!isLoading && leads.map((lead, i) => {
                const called = isCalled(lead);
                const booked = isBooked(lead);
                const isSelected = selected.has(lead.id);

                return (
                  <motion.tr
                    key={lead.id}
                    className={`lead-row ${isSelected ? 'row-selected' : ''}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025 }}
                    onClick={() => navigate(`/participants/${lead.id}`)}
                  >
                    {/* Checkbox */}
                    <td className="td-check" onClick={e => { e.stopPropagation(); toggleOne(lead.id); }}>
                      <button className="checkbox-btn">
                        {isSelected
                          ? <CheckSquare size={14} className="cb-checked" />
                          : <Square size={14} className="cb-empty" />
                        }
                      </button>
                    </td>

                    {/* Participant */}
                    <td>
                      <div className="avatar-cell">
                        <AvatarXS name={lead.name} />
                        <div>
                          <div className="lead-name">{lead.name}</div>
                          <div className="lead-email">{lead.email || '—'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Received */}
                    <td className="td-muted">{formatDate(lead.created_at)}</td>

                    {/* Phone */}
                    <td>
                      <span className={`phone-badge ${called ? 'called' : ''}`}>
                        {lead.phone || '—'}
                      </span>
                    </td>

                    {/* Source */}
                    <td className="td-muted">
                      {SOURCE_LABELS[lead.source] || humanize(lead.source) || '—'}
                    </td>

                    {/* Campaign */}
                    <td className="td-muted">
                      {lead.campaign?.name || lead.campaign_name || '—'}
                    </td>

                    {/* Stage */}
                    <td>
                      <StageBadge stageKey={lead.stage} label={lead.stage_display} />
                    </td>

                    {/* Assigned */}
                    <td>
                      {lead.assigned_staff ? (
                        <div className="avatar-cell">
                          <AvatarXS name={lead.assigned_staff.full_name || lead.assigned_staff.username} />
                          <span className="td-muted">
                            {(lead.assigned_staff.full_name || lead.assigned_staff.username || '').split(' ')[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="td-muted">—</span>
                      )}
                    </td>

                    {/* Booking */}
                    <td>
                      <StatusPill
                        active={booked}
                        activeLabel="Booked"
                        inactiveLabel="Not booked"
                        activeClass="pill-green"
                        inactiveClass="pill-gray"
                      />
                    </td>

                    {/* Call */}
                    <td>
                      <StatusPill
                        active={called}
                        activeLabel="Called"
                        inactiveLabel="Not called"
                        activeClass="pill-blue"
                        inactiveClass="pill-gray"
                      />
                    </td>

                    {/* Last Contacted */}
                    <td className="td-muted td-nowrap">
                      {relativeTime(lead.last_contacted || lead.updated_at)}
                    </td>

                    {/* Actions */}
                    <td className="td-actions" onClick={e => e.stopPropagation()}>
                      <RowMenu lead={lead} onDelete={handleDelete} />
                    </td>
                  </motion.tr>
                );
              })}

              {!isLoading && leads.length === 0 && (
                <tr>
                  <td colSpan={12} className="leads-empty">
                    <div className="empty-state">
                      <User size={32} strokeWidth={1.2} />
                      <p>No leads found</p>
                      <span>Try adjusting your search or filters</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {view === 'grid' && (
        <div className="leads-grid">
          {isLoading && Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="lead-card skeleton-card">
              <div className="skeleton" style={{ height: 18, width: '60%', borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 13, width: '80%', borderRadius: 4, marginBottom: 16 }} />
              <div className="skeleton" style={{ height: 13, borderRadius: 4, marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 13, borderRadius: 4, marginBottom: 6 }} />
            </div>
          ))}
          {!isLoading && leads.map((lead, i) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onDelete={handleDelete}
              onSelect={toggleOne}
              selected={selected.has(lead.id)}
              i={i}
            />
          ))}
          {!isLoading && leads.length === 0 && (
            <div className="leads-empty" style={{ gridColumn: '1/-1' }}>
              <div className="empty-state">
                <User size={32} strokeWidth={1.2} />
                <p>No leads found</p>
                <span>Try adjusting your search or filters</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Pagination ── */}
      {pageCount > 1 && (
        <div className="leads-pagination">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="page-btn">
            Previous
          </button>
          <div className="page-numbers">
            {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  className={`page-num-btn ${page === p ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              );
            })}
            {pageCount > 7 && <span className="page-ellipsis">…</span>}
          </div>
          <button disabled={page === pageCount} onClick={() => setPage(p => p + 1)} className="page-btn">
            Next
          </button>
        </div>
      )}

      {/* ── Import file input (hidden) ── */}
      <input
        ref={importRef}
        type="file"
        accept=".csv,.xlsx"
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files?.[0]) alert(`Import file: ${e.target.files[0].name}\n(Import API not yet implemented)`);
          e.target.value = '';
        }}
      />

      {/* ── Add Lead Modal ── */}
      <AnimatePresence>
        {showAddModal && <AddLeadModal onClose={() => setShowAddModal(false)} />}
      </AnimatePresence>
    </div>
  );
}
