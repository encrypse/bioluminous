import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, ClipboardList, AlertCircle, TriangleAlert, CheckCircle2,
  RefreshCw, Table2, Kanban, Plus, Search, MoreHorizontal, X,
  ChevronDown, Calendar, User, CheckSquare, Clipboard,
} from 'lucide-react';
import { BioLoaderInline } from '../components/ui/BioLoader';
import { humanize } from '../utils/humanize';
import { getTasks, createTask, updateTask, deleteTask, getParticipants, getStaff } from '../api';
import './Tasks.css';

/* ─── Constants ─────────────────────────────────────────── */
const TASK_TYPES = [
  { key: '', label: 'All task types' },
  { key: 'follow_up', label: 'Follow Up' },
  { key: 'callback', label: 'Callback' },
  { key: 'admin', label: 'Admin' },
  { key: 'note', label: 'Note' },
];

const PRIORITIES = [
  { key: '', label: 'All priorities' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'high', label: 'High' },
  { key: 'normal', label: 'Normal' },
  { key: 'low', label: 'Low' },
];

const STATUSES = [
  { key: '', label: 'All statuses' },
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'awaiting_response', label: 'Awaiting Response' },
  { key: 'completed', label: 'Completed' },
  { key: 'overdue', label: 'Overdue' },
];

const DUE_DATE_OPTIONS = [
  { key: '', label: 'Any due date' },
  { key: 'today', label: 'Due today' },
  { key: 'week', label: 'Due this week' },
  { key: 'overdue', label: 'Overdue' },
];

const KANBAN_COLS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'awaiting_response', label: 'Awaiting Response' },
  { key: 'completed', label: 'Completed' },
];

/* ─── Priority helpers ──────────────────────────────────── */
const PRIORITY_COLORS = {
  urgent: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  high:   { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  normal: { bg: '#eff6ff', color: '#3b82f6', border: '#bfdbfe' },
  low:    { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0' },
};

const STATUS_COLORS = {
  todo:               { bg: '#f8fafc', color: '#64748b' },
  open:               { bg: '#f8fafc', color: '#64748b' },
  in_progress:        { bg: '#eff6ff', color: '#3b82f6' },
  awaiting_response:  { bg: '#fffbeb', color: '#d97706' },
  completed:          { bg: '#f0fdf4', color: '#16a34a' },
  overdue:            { bg: '#fef2f2', color: '#dc2626' },
};

function priorityStyle(p) { return PRIORITY_COLORS[p] || PRIORITY_COLORS.normal; }
function statusStyle(s)   { return STATUS_COLORS[s]   || STATUS_COLORS.todo; }

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function fieldErrors(err) {
  const d = err?.response?.data;
  return d && typeof d === 'object' ? d : {};
}

/* ─── Main Component ────────────────────────────────────── */
export default function Tasks() {
  const qc = useQueryClient();
  const [view, setView] = useState('table');
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({
    search: '', staff: '', priority: '', status: '', type: '', dueDate: '',
  });

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const resetFilters = () => setFilters({ search: '', staff: '', priority: '', status: '', type: '', dueDate: '' });

  /* API params */
  const apiParams = {
    page_size: 200,
    ...(filters.status   ? { status:    filters.status }   : {}),
    ...(filters.priority ? { priority:  filters.priority } : {}),
    ...(filters.type     ? { task_type: filters.type }     : {}),
  };

  const { data: tasksData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['tasks', apiParams],
    queryFn: () => getTasks(apiParams).then(r => r.data.results ?? r.data),
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => getStaff().then(r => r.data.results ?? r.data),
  });

  const allTasks = tasksData || [];

  /* Client-side search + staff + dueDate filters */
  const tasks = allTasks.filter(t => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const haystack = [
        t.title, t.description, t.participant?.name,
        t.participant?.phone, t.assigned_staff?.full_name,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.staff) {
      if (String(t.assigned_staff?.id) !== String(filters.staff)) return false;
    }
    if (filters.dueDate === 'today') {
      if (!t.due_at) return false;
      const d = new Date(t.due_at);
      const now = new Date();
      if (d.toDateString() !== now.toDateString()) return false;
    }
    if (filters.dueDate === 'week') {
      if (!t.due_at) return false;
      const d = new Date(t.due_at);
      const now = new Date();
      const weekEnd = new Date(); weekEnd.setDate(now.getDate() + 7);
      if (d < now || d > weekEnd) return false;
    }
    if (filters.dueDate === 'overdue') {
      if (!t.due_at) return false;
      if (new Date(t.due_at) >= new Date()) return false;
      if (t.status === 'completed') return false;
    }
    return true;
  });

  /* KPIs */
  const kpiActive    = allTasks.filter(t => !['completed'].includes(t.status)).length;
  const kpiUrgent    = allTasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length;
  const kpiOverdue   = allTasks.filter(t =>
    t.due_at && new Date(t.due_at) < new Date() && t.status !== 'completed'
  ).length;
  const kpiCompleted = allTasks.filter(t => t.status === 'completed').length;

  /* Mutations */
  const completeMut = useMutation({
    mutationFn: (id) => updateTask(id, { status: 'completed' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
  const deleteMut = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  return (
    <div className="tasks-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-sub">Follow-ups, callbacks and internal alerts, assigned and prioritised.</p>
        </div>
        <button className="tasks-queue-btn" onClick={() => setShowCreate(true)}>
          <ClipboardList size={15} /> Task queue
        </button>
      </div>

      {/* AI Suggestions Card */}
      <div className="tasks-ai-card">
        <div className="tasks-ai-card-header">
          <div className="tasks-ai-title">
            <Sparkles size={15} color="#f59e0b" />
            AI task suggestions
          </div>
          <span className="badge-requires-review">Requires human review</span>
        </div>
        <p className="tasks-ai-subtitle">
          Missed-follow-up and task-risk suggestions. Requires human review before action.
        </p>
        <div className="tasks-ai-item">
          <div className="tasks-ai-item-icon">
            <Search size={14} color="#64748b" />
          </div>
          <div className="tasks-ai-item-body">
            <div className="tasks-ai-item-title">
              Review open tasks
              <span className="tasks-ai-info-badge">tasks</span>
            </div>
            <p className="tasks-ai-item-text">
              No AI escalation is currently suggested beyond normal task queue review.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="tasks-kpi-row">
        <KpiCard
          label="Active Tasks"
          value={kpiActive}
          icon={<ClipboardList size={20} color="#64748b" />}
        />
        <KpiCard
          label="Urgent Focus"
          value={kpiUrgent}
          icon={<AlertCircle size={20} color="#dc2626" />}
          accent="#dc2626"
        />
        <KpiCard
          label="Overdue"
          value={kpiOverdue}
          icon={<TriangleAlert size={20} color="#dc2626" />}
          accent="#dc2626"
        />
        <KpiCard
          label="Completed"
          value={kpiCompleted}
          icon={<CheckCircle2 size={20} color="#16a34a" />}
          accent="#16a34a"
        />
      </div>

      {/* Queue Card */}
      <div className="tasks-queue-card">
        <div className="tasks-queue-card-header">
          <div className="tasks-queue-title-group">
            <div className="tasks-queue-title">
              <ClipboardList size={16} color="#0a7c68" />
              Team task queue
            </div>
            <p className="tasks-queue-subtitle">Manager view includes team tasks allowed by RLS.</p>
          </div>
          <div className="tasks-toolbar">
            <button
              className="btn-refresh"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw size={13} className={isFetching ? 'spin' : ''} />
              Refresh
            </button>
            <button
              className={`view-toggle-btn ${view === 'table' ? 'active' : ''}`}
              onClick={() => setView('table')}
            >
              <Table2 size={14} /> Table
            </button>
            <button
              className={`view-toggle-btn ${view === 'kanban' ? 'active' : ''}`}
              onClick={() => setView('kanban')}
            >
              <Kanban size={14} /> Kanban
            </button>
            <button className="btn-create-task" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> Create task
            </button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="tasks-filter-row">
          <div className="tasks-search-wrap">
            <Search size={13} color="#94a3b8" />
            <input
              className="tasks-search-input"
              placeholder="Search tasks, participants, phone..."
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
            />
          </div>

          <FilterSelect
            value={filters.staff}
            onChange={v => setFilter('staff', v)}
            placeholder="All staff"
          >
            <option value="">All staff</option>
            {(staffData || []).map(s => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </FilterSelect>

          <FilterSelect value={filters.priority} onChange={v => setFilter('priority', v)}>
            {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </FilterSelect>

          <FilterSelect value={filters.status} onChange={v => setFilter('status', v)}>
            {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </FilterSelect>

          <FilterSelect value={filters.type} onChange={v => setFilter('type', v)}>
            {TASK_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </FilterSelect>

          <FilterSelect value={filters.dueDate} onChange={v => setFilter('dueDate', v)}>
            {DUE_DATE_OPTIONS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
          </FilterSelect>

          <button className="btn-reset-filters" onClick={resetFilters}>Reset</button>
        </div>

        {/* Table or Kanban */}
        {isLoading ? (
          <div className="tasks-loading">
            <BioLoaderInline /> Loading tasks…
          </div>
        ) : view === 'table' ? (
          <TableView
            tasks={tasks}
            onComplete={id => completeMut.mutate(id)}
            onDelete={id => deleteMut.mutate(id)}
            onCreateTask={() => setShowCreate(true)}
          />
        ) : (
          <KanbanView
            tasks={tasks}
            onComplete={id => completeMut.mutate(id)}
          />
        )}
      </div>

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateTaskModal
            staffData={staffData || []}
            onClose={() => setShowCreate(false)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ['tasks'] });
              setShowCreate(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── KPI Card ──────────────────────────────────────────── */
function KpiCard({ label, value, icon, accent }) {
  return (
    <div className="tasks-kpi-card">
      <div className="tasks-kpi-icon" style={accent ? { background: `${accent}15` } : {}}>
        {icon}
      </div>
      <div>
        <div className="tasks-kpi-value" style={accent ? { color: accent } : {}}>{value}</div>
        <div className="tasks-kpi-label">{label}</div>
      </div>
    </div>
  );
}

/* ─── Filter Select ─────────────────────────────────────── */
function FilterSelect({ value, onChange, children }) {
  return (
    <div className="tasks-filter-select-wrap">
      <select
        className="tasks-filter-select"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown size={12} className="tasks-filter-chevron" />
    </div>
  );
}

/* ─── Table View ────────────────────────────────────────── */
function TableView({ tasks, onComplete, onDelete, onCreateTask }) {
  if (tasks.length === 0) {
    return (
      <div className="tasks-empty-state">
        <Clipboard size={36} color="#cbd5e1" />
        <div className="tasks-empty-title">No tasks match this view</div>
        <p className="tasks-empty-sub">
          Adjust filters or create a follow-up task for a participant.
        </p>
        <button className="btn-create-task" onClick={onCreateTask}>
          <Plus size={14} /> Create task
        </button>
      </div>
    );
  }

  return (
    <div className="tasks-table-wrap">
      <table className="tasks-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}><input type="checkbox" /></th>
            <th>TASK</th>
            <th>TYPE</th>
            <th>PRIORITY</th>
            <th>DUE DATE</th>
            <th>ASSIGNED</th>
            <th>STATUS</th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => (
            <TaskTableRow
              key={t.id}
              task={t}
              i={i}
              onComplete={onComplete}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Task Table Row ────────────────────────────────────── */
function TaskTableRow({ task: t, i, onComplete, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const ps = priorityStyle(t.priority);
  const ss = statusStyle(t.status);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const isOverdue = t.due_at && new Date(t.due_at) < new Date() && t.status !== 'completed';

  return (
    <motion.tr
      className="tasks-table-row"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.03 }}
    >
      <td><input type="checkbox" /></td>
      <td>
        <div className="task-cell-title">{t.title || t.description || '—'}</div>
        {t.participant?.name && (
          <div className="task-cell-sub">{t.participant.name}</div>
        )}
      </td>
      <td>
        <span className="task-type-chip">
          {humanize(t.task_type)}
        </span>
      </td>
      <td>
        <span
          className="priority-badge"
          style={{ background: ps.bg, color: ps.color, borderColor: ps.border }}
        >
          {humanize(t.priority)}
        </span>
      </td>
      <td>
        {t.due_at ? (
          <span className={`task-due-cell ${isOverdue ? 'overdue' : ''}`}>
            <Calendar size={12} />
            {new Date(t.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        ) : '—'}
      </td>
      <td>
        {t.assigned_staff ? (
          <div className="task-assignee-cell">
            <div className="task-avatar">{initials(t.assigned_staff.full_name)}</div>
            <span>{t.assigned_staff.full_name}</span>
          </div>
        ) : '—'}
      </td>
      <td>
        <span
          className="status-badge"
          style={{ background: ss.bg, color: ss.color }}
        >
          {humanize(t.status || 'todo')}
        </span>
      </td>
      <td>
        <div className="task-row-actions" ref={menuRef}>
          <button
            className="task-menu-btn"
            onClick={() => setMenuOpen(o => !o)}
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <div className="task-menu-dropdown">
              {t.status !== 'completed' && (
                <button onClick={() => { onComplete(t.id); setMenuOpen(false); }}>
                  <CheckSquare size={13} /> Complete
                </button>
              )}
              <button onClick={() => { onDelete(t.id); setMenuOpen(false); }} className="danger">
                <X size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </td>
    </motion.tr>
  );
}

/* ─── Kanban View ───────────────────────────────────────── */
function KanbanView({ tasks, onComplete }) {
  const grouped = KANBAN_COLS.reduce((acc, col) => {
    acc[col.key] = tasks.filter(t => {
      const s = t.status || 'todo';
      if (col.key === 'todo') return s === 'todo' || s === 'open';
      return s === col.key;
    });
    return acc;
  }, {});

  return (
    <div className="task-kanban">
      {KANBAN_COLS.map(col => (
        <div key={col.key} className="kanban-col">
          <div className="kanban-col-header">
            <span>{col.label}</span>
            <span className="kanban-col-count">{grouped[col.key].length}</span>
          </div>
          {grouped[col.key].map(t => (
            <KanbanCard key={t.id} task={t} onComplete={onComplete} />
          ))}
          {grouped[col.key].length === 0 && (
            <div className="kanban-empty">No tasks</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Kanban Card ───────────────────────────────────────── */
function KanbanCard({ task: t, onComplete }) {
  const ps = priorityStyle(t.priority);
  return (
    <div className="kanban-card">
      <div className="kanban-card-title">{t.title || t.description || '—'}</div>
      {t.participant?.name && (
        <div className="kanban-card-participant">{t.participant.name}</div>
      )}
      <div className="kanban-card-meta">
        <span
          className="priority-badge"
          style={{ background: ps.bg, color: ps.color, borderColor: ps.border }}
        >
          {humanize(t.priority)}
        </span>
        {t.due_at && (
          <span className="kanban-card-due">
            <Calendar size={10} />
            {new Date(t.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      {t.assigned_staff && (
        <div className="kanban-card-assignee">
          <div className="task-avatar sm">{initials(t.assigned_staff.full_name)}</div>
          <span>{t.assigned_staff.full_name}</span>
        </div>
      )}
      {t.status !== 'completed' && (
        <button className="kanban-complete-btn" onClick={() => onComplete(t.id)}>
          <CheckSquare size={11} /> Complete
        </button>
      )}
    </div>
  );
}

/* ─── Create Task Modal ─────────────────────────────────── */
function CreateTaskModal({ staffData, onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: '', participant: '', task_type: 'follow_up', priority: 'normal',
    due_at: '', assigned_staff: '', description: '',
  });
  const [errors, setErrors] = useState({});

  const { data: participantsData } = useQuery({
    queryKey: ['participants', { page_size: 100 }],
    queryFn: () => getParticipants({ page_size: 100 }).then(r => r.data.results ?? r.data),
  });

  const mutation = useMutation({
    mutationFn: createTask,
    onSuccess,
    onError: (e) => setErrors(fieldErrors(e)),
  });

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(p => ({ ...p, [k]: undefined })); };

  const handleSubmit = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const payload = {
      ...form,
      ...(form.participant ? { participant: Number(form.participant) } : {}),
      ...(form.assigned_staff ? { assigned_staff: Number(form.assigned_staff) } : {}),
    };
    mutation.mutate(payload);
  };

  const globalError = errors?.detail || errors?.non_field_errors?.[0];

  return (
    <motion.div
      className="tasks-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="tasks-modal"
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.97 }}
      >
        <div className="tasks-modal-header">
          <h3>Create task</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="tasks-modal-body">
          {/* Title */}
          <div className={`edit-field ${errors.title ? 'has-error' : ''}`}>
            <label>Title <span className="req">*</span></label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Task title"
            />
            {errors.title && <span className="field-error">{errors.title}</span>}
          </div>

          {/* Participant */}
          <div className="edit-field">
            <label>Participant</label>
            <select value={form.participant} onChange={e => set('participant', e.target.value)}>
              <option value="">Select participant…</option>
              {(participantsData || []).map(p => (
                <option key={p.id} value={p.id}>{p.name || p.full_name}</option>
              ))}
            </select>
          </div>

          <div className="tasks-modal-grid">
            {/* Type */}
            <div className="edit-field">
              <label>Type</label>
              <select value={form.task_type} onChange={e => set('task_type', e.target.value)}>
                <option value="follow_up">Follow Up</option>
                <option value="callback">Callback</option>
                <option value="admin">Admin</option>
                <option value="note">Note</option>
              </select>
            </div>

            {/* Priority */}
            <div className="edit-field">
              <label>Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Due Date */}
            <div className="edit-field">
              <label>Due Date</label>
              <input
                type="datetime-local"
                value={form.due_at}
                onChange={e => set('due_at', e.target.value)}
              />
            </div>

            {/* Assigned Staff */}
            <div className="edit-field">
              <label>Assigned staff</label>
              <select value={form.assigned_staff} onChange={e => set('assigned_staff', e.target.value)}>
                <option value="">Unassigned</option>
                {staffData.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="edit-field">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Add notes or details…"
              rows={3}
            />
          </div>

          {globalError && (
            <div className="booking-form-error">
              <AlertCircle size={13} /> {globalError}
            </div>
          )}
        </div>

        <div className="tasks-modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-create-task" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? <><BioLoaderInline /> Creating…</> : <><Plus size={14} /> Create task</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
