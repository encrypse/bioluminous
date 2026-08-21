import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, Plus, X, AlertCircle, Search,
  ChevronLeft, ChevronRight, LayoutList, CalendarDays,
  Inbox, Users, PhoneCall, CheckCircle2, RotateCcw,
} from 'lucide-react';
import { getBookings, createBooking, updateBooking, getParticipants, getStaff } from '../api';
import { BioLoaderInline } from '../components/ui/BioLoader';
import { humanize } from '../utils/humanize';
import './Bookings.css';

// ─── Constants ─────────────────────────────────────────────
const BOOKING_TYPES = [
  { key: 'pre_screening_call', label: 'Pre-screening Call' },
  { key: 'screening_visit',    label: 'Screening Visit' },
  { key: 'follow_up',         label: 'Follow Up' },
  { key: 'other',             label: 'Other' },
];

const STATUS_COLORS = {
  scheduled:   { bg: '#eff6ff', color: '#2563eb' },
  completed:   { bg: '#ecfdf5', color: '#059669' },
  no_show:     { bg: '#f3f4f6', color: '#6b7280' },
  cancelled:   { bg: '#fef2f2', color: '#dc2626' },
  rescheduled: { bg: '#fffbeb', color: '#d97706' },
};

const STATUS_DOT = {
  scheduled:   '#2563eb',
  completed:   '#059669',
  no_show:     '#6b7280',
  cancelled:   '#dc2626',
  rescheduled: '#d97706',
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Helpers ───────────────────────────────────────────────
function fieldErrors(err) {
  const data = err?.response?.data;
  if (!data || typeof data !== 'object') return {};
  return data;
}

/** Monday of the ISO week that contains `date` */
function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function toLocalDatetimeValue(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ─── Participant search with debounce ──────────────────────
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

// ─── Create Appointment Modal ──────────────────────────────
function CreateApptModal({ defaultDate, onClose, onSuccess }) {
  const qc = useQueryClient();
  const EMPTY_FORM = {
    participant_id: '',
    assigned_staff_id: '',
    booking_type: 'pre_screening_call',
    scheduled_at: defaultDate ? toLocalDatetimeValue(defaultDate) : '',
    end_time: '',
    location: '',
    meeting_link: '',
    notes: '',
  };
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [pSearch, setPSearch] = useState('');
  const [pSelected, setPSelected] = useState(null);
  const [showPDrop, setShowPDrop] = useState(false);
  const debouncedPSearch = useDebounce(pSearch, 280);
  const pRef = useRef(null);

  const { data: participantsData } = useQuery({
    queryKey: ['participants-search-modal', debouncedPSearch],
    queryFn: () => getParticipants({ page_size: 20, search: debouncedPSearch }).then(r => r.data.results || r.data),
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff-list'],
    queryFn: () => getStaff().then(r => r.data.results || r.data),
  });

  const participants = participantsData || [];
  const staffList = staffData || [];

  const mutation = useMutation({
    mutationFn: (payload) => {
      const d = { ...payload };
      if (!d.assigned_staff_id) delete d.assigned_staff_id;
      if (!d.end_time) delete d.end_time;
      if (!d.location) delete d.location;
      if (!d.meeting_link) delete d.meeting_link;
      if (!d.notes) delete d.notes;
      return createBooking(d);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      onSuccess?.();
      onClose();
    },
    onError: (e) => setErrors(fieldErrors(e)),
  });

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(p => ({ ...p, [k]: undefined }));
  };

  const handleSubmit = () => {
    const errs = {};
    if (!form.participant_id) errs.participant_id = 'Select a participant';
    if (!form.scheduled_at) errs.scheduled_at = 'Start time is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    mutation.mutate(form);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (pRef.current && !pRef.current.contains(e.target)) setShowPDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const globalError = errors?.detail || errors?.non_field_errors?.[0];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="create-appt-modal"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="create-appt-header">
          <div className="create-appt-icon">
            <CalendarDays size={18} />
          </div>
          <div className="create-appt-header-text">
            <h2>Create appointment</h2>
            <p>Book a pre-screening call or related follow-up. Database triggers update participant booking status.</p>
          </div>
          <button className="create-appt-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Form */}
        <div className="create-appt-body">
          {globalError && (
            <div className="booking-form-error" style={{ marginBottom: 16 }}>
              <AlertCircle size={13} /> {globalError}
            </div>
          )}

          <div className="create-appt-grid">
            {/* Participant */}
            <div className={`edit-field ${errors.participant_id ? 'has-error' : ''}`} ref={pRef} style={{ gridColumn: '1 / -1', position: 'relative' }}>
              <label>Participant <span className="req">*</span></label>
              <div className="participant-search-wrap" onClick={() => setShowPDrop(true)}>
                <Search size={13} />
                <input
                  placeholder="Search by name, phone or email…"
                  value={pSearch}
                  onChange={e => {
                    setPSearch(e.target.value);
                    setPSelected(null);
                    set('participant_id', '');
                    setShowPDrop(true);
                  }}
                  onFocus={() => setShowPDrop(true)}
                />
                {pSelected && (
                  <button
                    type="button"
                    style={{ color: 'var(--text-muted)', display: 'flex' }}
                    onClick={() => { setPSelected(null); setPSearch(''); set('participant_id', ''); }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              {showPDrop && participants.length > 0 && !pSelected && (
                <div className="participant-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10 }}>
                  {participants.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="participant-option"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setPSelected(p);
                        setPSearch(p.name);
                        set('participant_id', p.id);
                        setShowPDrop(false);
                      }}
                    >
                      <span className="p-opt-name">{p.name}</span>
                      <span className="p-opt-meta">{p.phone} · {p.stage_display}</span>
                    </button>
                  ))}
                </div>
              )}
              {errors.participant_id && <span className="field-error">{errors.participant_id}</span>}
            </div>

            {/* Assigned Staff */}
            <div className="edit-field">
              <label>Assigned staff</label>
              <select value={form.assigned_staff_id} onChange={e => set('assigned_staff_id', e.target.value)}>
                <option value="">Use participant owner</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name || s.username || s.email}</option>
                ))}
              </select>
            </div>

            {/* Booking Type */}
            <div className={`edit-field ${errors.booking_type ? 'has-error' : ''}`}>
              <label>Appointment type</label>
              <select value={form.booking_type} onChange={e => set('booking_type', e.target.value)}>
                {BOOKING_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              {errors.booking_type && <span className="field-error">{Array.isArray(errors.booking_type) ? errors.booking_type[0] : errors.booking_type}</span>}
            </div>

            {/* Start time */}
            <div className={`edit-field ${errors.scheduled_at ? 'has-error' : ''}`}>
              <label>Start time <span className="req">*</span></label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={e => set('scheduled_at', e.target.value)}
              />
              {errors.scheduled_at && <span className="field-error">{Array.isArray(errors.scheduled_at) ? errors.scheduled_at[0] : errors.scheduled_at}</span>}
            </div>

            {/* End time */}
            <div className={`edit-field ${errors.end_time ? 'has-error' : ''}`}>
              <label>End time</label>
              <input
                type="datetime-local"
                value={form.end_time}
                onChange={e => set('end_time', e.target.value)}
              />
            </div>

            {/* Location */}
            <div className="edit-field">
              <label>Location</label>
              <input
                type="text"
                placeholder="Phone, clinic room, or address"
                value={form.location}
                onChange={e => set('location', e.target.value)}
              />
            </div>

            {/* Meeting link */}
            <div className="edit-field">
              <label>Meeting link</label>
              <input
                type="url"
                placeholder="https://…"
                value={form.meeting_link}
                onChange={e => set('meeting_link', e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="edit-field" style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={3}
                placeholder="Internal booking note"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="create-appt-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? <><BioLoaderInline /> Creating…</> : 'Create appointment'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Calendar Day Column ───────────────────────────────────
function DayColumn({ date, bookings, isToday, onNewBooking }) {
  const dayBookings = bookings.filter(b => {
    if (!b.scheduled_at) return false;
    return isSameDay(new Date(b.scheduled_at), date);
  });

  const completed = dayBookings.filter(b => b.status === 'completed').length;

  return (
    <div
      className={`bookings-day-col${isToday ? ' today' : ''}`}
      onClick={() => onNewBooking(date)}
      title="Click to add a booking on this day"
    >
      <div className="bookings-day-header">
        <div className="bookings-day-name-row">
          <span className="bookings-day-name">{DAY_NAMES[date.getDay() === 0 ? 6 : date.getDay() - 1]}</span>
          {isToday && <span className="bookings-day-today-badge">TODAY</span>}
        </div>
        <div className="bookings-day-date">
          {date.getDate()} {MONTH_NAMES[date.getMonth()]} {date.getFullYear()}
        </div>
      </div>

      <div className="bookings-day-stats">
        <div>
          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 11 }}>{dayBookings.length}</div>
          <div>TOTAL</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, color: '#059669', fontSize: 11 }}>{completed}</div>
          <div>DONE</div>
        </div>
      </div>

      {dayBookings.length === 0 ? (
        <div className="bookings-day-empty" onClick={(e) => e.stopPropagation()}>
          <Inbox size={18} style={{ marginBottom: 6, opacity: 0.4 }} />
          <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 3 }}>
            {isToday ? 'Clear schedule' : 'No bookings'}
          </div>
          <div style={{ fontSize: 10, lineHeight: 1.4 }}>
            {isToday
              ? 'This day is open for fresh pre-screening appointments.'
              : 'Available for new pre-screening appointments.'}
          </div>
        </div>
      ) : (
        <div className="bookings-day-cards" onClick={(e) => e.stopPropagation()}>
          {dayBookings.map(b => (
            <div key={b.id} className="bookings-day-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <span
                  className="status-dot"
                  style={{ background: STATUS_DOT[b.status] || STATUS_DOT.scheduled }}
                />
                <span style={{ fontWeight: 600, color: '#0d2118', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.participant?.name || '—'}
                </span>
              </div>
              <div style={{ color: '#64748b', fontSize: 10 }}>{fmtTime(b.scheduled_at)}</div>
              <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 1 }}>
                {b.booking_type_display || humanize(b.booking_type)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Bookings Page ────────────────────────────────────
export default function Bookings() {
  const qc = useQueryClient();

  // List view state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ participant_id: '', booking_type: 'pre_screening_call', scheduled_at: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [participantSearch, setParticipantSearch] = useState('');

  // View toggle
  const [calView, setCalView] = useState('list'); // 'list' | 'calendar'
  const [weekOffset, setWeekOffset] = useState(0);
  const [calDayView, setCalDayView] = useState('week'); // 'day' | 'week'
  const [showCreateAppt, setShowCreateAppt] = useState(false);
  const [apptDefaultDate, setApptDefaultDate] = useState(null);

  // ── Queries ──
  const { data, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => getBookings({ page_size: 100 }).then(r => r.data.results || r.data),
  });

  const { data: participantsData } = useQuery({
    queryKey: ['participants-search', participantSearch],
    queryFn: () => getParticipants({ page_size: 20, search: participantSearch }).then(r => r.data.results || r.data),
    enabled: showForm,
  });

  // ── Mutations (list view) ──
  const mutation = useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      setShowForm(false);
      setForm({ participant_id: '', booking_type: 'pre_screening_call', scheduled_at: '', notes: '' });
      setErrors({});
    },
    onError: (e) => setErrors(fieldErrors(e)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateBooking(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });

  const bookings = data || [];
  const participants = participantsData || [];
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(p => ({ ...p, [k]: undefined })); };

  const upcoming = bookings.filter(b => b.status !== 'cancelled' && b.status !== 'completed');
  const past = bookings.filter(b => b.status === 'completed' || b.status === 'cancelled');

  const handleSubmit = () => {
    const errs = {};
    if (!form.participant_id) errs.participant_id = 'Select a participant';
    if (!form.scheduled_at) errs.scheduled_at = 'Date & time is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    mutation.mutate(form);
  };

  const globalError = errors?.detail || errors?.non_field_errors?.[0];

  // ── Calendar week computation ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = getMondayOf(addDays(today, weekOffset * 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = weekDays[6];

  const visibleDays = calDayView === 'day' ? [today] : weekDays;

  const weekBookings = bookings.filter(b => {
    if (!b.scheduled_at) return false;
    const d = new Date(b.scheduled_at);
    d.setHours(0, 0, 0, 0);
    return d >= weekStart && d <= weekEnd;
  });

  const visibleBookings = calDayView === 'day'
    ? bookings.filter(b => b.scheduled_at && isSameDay(new Date(b.scheduled_at), today))
    : weekBookings;

  // KPI counts
  const kpiTotal = visibleBookings.length;
  const kpiScheduledRescheduled = visibleBookings.filter(b => b.status === 'scheduled' || b.status === 'rescheduled').length;
  const assignedStaffIds = new Set(visibleBookings.map(b => b.assigned_staff_id || b.assigned_staff?.id).filter(Boolean));
  const kpiStaff = assignedStaffIds.size;
  const kpiUrgent = visibleBookings.filter(b => b.status === 'no_show' || b.priority === 'urgent').length;

  const weekLabel = calDayView === 'day'
    ? `${today.getDate()} ${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`
    : `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]} – ${weekEnd.getDate()} ${MONTH_NAMES[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;

  const handleNewBookingForDay = (date) => {
    const d = new Date(date);
    d.setHours(9, 0, 0, 0);
    setApptDefaultDate(d);
    setShowCreateAppt(true);
  };

  // ── Render: Calendar view ──────────────────────────────────
  if (calView === 'calendar') {
    return (
      <div className="bookings-page">
        {/* Breadcrumb */}
        <div className="cal-breadcrumb">
          <span>Recruitment</span>
          <span className="cal-breadcrumb-sep">›</span>
          <span
            className="cal-breadcrumb-link"
            onClick={() => setCalView('list')}
          >Bookings</span>
          <span className="cal-breadcrumb-sep">›</span>
          <span className="cal-breadcrumb-active">Calendar</span>
        </div>

        {/* Page Header */}
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="page-title">Booking calendar</h1>
            <p className="page-sub">Day and week views for pre-screening appointments and staff accountability.</p>
          </div>
          <button className="btn-view-toggle" onClick={() => setCalView('list')}>
            <LayoutList size={14} />
            List view
          </button>
        </div>

        {/* KPI Row */}
        <div className="bookings-calendar-kpi-row">
          <div className="bookings-kpi-card">
            <div className="bookings-kpi-label">Appointments this view</div>
            <div className="bookings-kpi-value">{kpiTotal}</div>
          </div>
          <div className="bookings-kpi-card">
            <div className="bookings-kpi-label">Scheduled / Rescheduled</div>
            <div className="bookings-kpi-value" style={{ color: '#2563eb' }}>{kpiScheduledRescheduled}</div>
          </div>
          <div className="bookings-kpi-card">
            <div className="bookings-kpi-label">Assigned Staff</div>
            <div className="bookings-kpi-value" style={{ color: '#0a7c68' }}>{kpiStaff}</div>
          </div>
          <div className="bookings-kpi-card">
            <div className="bookings-kpi-label">Needs Urgent Call</div>
            <div className="bookings-kpi-value" style={{ color: kpiUrgent > 0 ? '#dc2626' : '#1e293b' }}>{kpiUrgent}</div>
          </div>
        </div>

        {/* Calendar Nav */}
        <div className="bookings-calendar-nav">
          <button className="cal-nav-btn" onClick={() => setWeekOffset(o => o - 1)} title="Previous">
            <ChevronLeft size={16} />
          </button>
          <button className="cal-nav-btn" onClick={() => setWeekOffset(o => o + 1)} title="Next">
            <ChevronRight size={16} />
          </button>
          <button
            className="cal-nav-btn today-btn"
            onClick={() => setWeekOffset(0)}
          >
            Today
          </button>

          <span className="bookings-calendar-week-label">{weekLabel}</span>

          <div className="cal-view-pills">
            <button
              className={`cal-pill${calDayView === 'day' ? ' active' : ''}`}
              onClick={() => setCalDayView('day')}
            >
              Day
            </button>
            <button
              className={`cal-pill${calDayView === 'week' ? ' active' : ''}`}
              onClick={() => setCalDayView('week')}
            >
              Week
            </button>
          </div>

          <div style={{ flex: 1 }} />

          <button
            className="btn-primary-sm"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => { setApptDefaultDate(today); setShowCreateAppt(true); }}
          >
            <Plus size={14} /> New booking
          </button>
        </div>

        {/* Week / Day grid */}
        <div className={`bookings-week-grid${calDayView === 'day' ? ' day-only' : ''}`}>
          {visibleDays.map((day, i) => (
            <DayColumn
              key={i}
              date={day}
              bookings={bookings}
              isToday={isSameDay(day, today)}
              onNewBooking={handleNewBookingForDay}
            />
          ))}
        </div>

        {/* Create Appointment Modal */}
        <AnimatePresence>
          {showCreateAppt && (
            <CreateApptModal
              defaultDate={apptDefaultDate}
              onClose={() => setShowCreateAppt(false)}
              onSuccess={() => qc.invalidateQueries({ queryKey: ['bookings'] })}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Render: List view ──────────────────────────────────────
  return (
    <div className="bookings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bookings</h1>
          <p className="page-sub">{upcoming.length} upcoming · {past.length} past</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-view-toggle" onClick={() => setCalView('calendar')}>
            <CalendarDays size={14} />
            Calendar view
          </button>
          <button className="btn-primary-sm" onClick={() => setShowForm(true)}>
            <Plus size={15} /> New Booking
          </button>
        </div>
      </div>

      {showForm && (
        <motion.div className="booking-form-card" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="booking-form-header">
            <h3>New Booking</h3>
            <button onClick={() => { setShowForm(false); setErrors({}); }}><X size={16} /></button>
          </div>
          <div className="booking-form-grid">
            {/* Participant picker */}
            <div className={`edit-field full ${errors.participant_id ? 'has-error' : ''}`}>
              <label>Participant <span className="req">*</span></label>
              <div className="participant-search-wrap">
                <Search size={13} />
                <input
                  placeholder="Search by name, phone or email..."
                  value={participantSearch}
                  onChange={e => setParticipantSearch(e.target.value)}
                />
              </div>
              {participants.length > 0 && !form.participant_id && (
                <div className="participant-dropdown">
                  {participants.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="participant-option"
                      onClick={() => { set('participant_id', p.id); setParticipantSearch(p.name); }}
                    >
                      <span className="p-opt-name">{p.name}</span>
                      <span className="p-opt-meta">{p.phone} · {p.stage_display}</span>
                    </button>
                  ))}
                </div>
              )}
              {errors.participant_id && <span className="field-error">{errors.participant_id}</span>}
            </div>

            <div className={`edit-field ${errors.booking_type ? 'has-error' : ''}`}>
              <label>Type</label>
              <select value={form.booking_type} onChange={e => set('booking_type', e.target.value)}>
                {BOOKING_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              {errors.booking_type && <span className="field-error">{Array.isArray(errors.booking_type) ? errors.booking_type[0] : errors.booking_type}</span>}
            </div>

            <div className={`edit-field ${errors.scheduled_at ? 'has-error' : ''}`}>
              <label>Date & Time <span className="req">*</span></label>
              <input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={e => set('scheduled_at', e.target.value)}
              />
              {errors.scheduled_at && <span className="field-error">{Array.isArray(errors.scheduled_at) ? errors.scheduled_at[0] : errors.scheduled_at}</span>}
            </div>

            <div className="edit-field full">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Optional notes" />
            </div>
          </div>

          {globalError && (
            <div className="booking-form-error">
              <AlertCircle size={13} /> {globalError}
            </div>
          )}

          <div className="booking-form-actions">
            <button className="btn-ghost" onClick={() => { setShowForm(false); setErrors({}); }}>Cancel</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? <><BioLoaderInline /> Creating…</> : 'Create Booking'}
            </button>
          </div>
        </motion.div>
      )}

      <div className="bookings-section">
        <h2 className="section-label">UPCOMING</h2>
        <div className="bookings-grid">
          {isLoading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />
          ))}
          {!isLoading && upcoming.map((b, i) => {
            const sc = STATUS_COLORS[b.status] || STATUS_COLORS.scheduled;
            return (
              <motion.div key={b.id} className="booking-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="booking-card-header">
                  <div className="booking-type-icon"><Calendar size={14} /></div>
                  <span className="booking-badge" style={{ background: sc.bg, color: sc.color }}>{b.status_display || humanize(b.status)}</span>
                </div>
                <div className="booking-title">{b.booking_type_display || humanize(b.booking_type)}</div>
                {b.participant?.name && <div className="booking-participant">{b.participant.name}</div>}
                <div className="booking-time">
                  <Clock size={11} />
                  {b.scheduled_at ? new Date(b.scheduled_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBC'}
                </div>
                <div className="booking-actions">
                  <button onClick={() => statusMutation.mutate({ id: b.id, status: 'completed' })} className="booking-action-btn confirm">Complete</button>
                  <button onClick={() => statusMutation.mutate({ id: b.id, status: 'cancelled' })} className="booking-action-btn cancel">Cancel</button>
                </div>
              </motion.div>
            );
          })}
          {!isLoading && upcoming.length === 0 && <div className="bookings-empty">No upcoming bookings</div>}
        </div>
      </div>

      {past.length > 0 && (
        <div className="bookings-section">
          <h2 className="section-label">PAST</h2>
          <div className="bookings-list">
            {past.map(b => {
              const sc = STATUS_COLORS[b.status] || STATUS_COLORS.completed;
              return (
                <div key={b.id} className="booking-list-item">
                  <div className="booking-type-icon sm"><Calendar size={12} /></div>
                  <div className="booking-list-info">
                    <span className="booking-list-title">{b.booking_type_display || humanize(b.booking_type)}</span>
                    {b.participant?.name && <span className="booking-list-sub">{b.participant.name}</span>}
                  </div>
                  <div className="booking-list-date">{b.scheduled_at ? new Date(b.scheduled_at).toLocaleDateString('en-GB') : '—'}</div>
                  <span className="booking-badge sm" style={{ background: sc.bg, color: sc.color }}>{b.status_display || humanize(b.status)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
