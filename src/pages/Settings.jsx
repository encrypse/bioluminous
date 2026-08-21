import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Building2, Filter, FileText, Zap,
  CalendarCheck, Bell, Save, Eye, EyeOff, AlertTriangle,
  Plus, User, Shield,
} from 'lucide-react';
import { getStaff, createStaff, updateStaff, getPipelineStages, savePipelineStages } from '../api';
import TimezoneSelect from '../components/ui/TimezoneSelect';
import {
  getWorkspaceTz, setWorkspaceTz,
  getDateFormat, setDateFormat,
} from '../utils/timezone';
import './Settings.css';

const NAV_ITEMS = [
  { key: 'overview',      label: 'Overview',      Icon: LayoutDashboard },
  { key: 'organisation',  label: 'Organisation',  Icon: Building2 },
  { key: 'pipeline',      label: 'Pipeline',      Icon: Filter },
  { key: 'templates',     label: 'Templates',     Icon: FileText },
  { key: 'automation',    label: 'Automation',    Icon: Zap },
  { key: 'booking',       label: 'Booking',       Icon: CalendarCheck },
  { key: 'notifications', label: 'Notifications', Icon: Bell },
];

const PIPELINE_STAGES = [
  { name: 'New Lead',                 colour: '#3b82f6', order: 1,  active: true  },
  { name: 'Auto Message Sent',        colour: '#a855f7', order: 2,  active: true  },
  { name: 'Booking Pending',          colour: '#f59e0b', order: 3,  active: true  },
  { name: 'Pre-screening Booked',     colour: '#22c55e', order: 4,  active: true  },
  { name: 'Booked But Not Called',    colour: '#ef4444', order: 5,  active: true  },
  { name: 'Called',                   colour: '#1e3a5f', order: 6,  active: true  },
  { name: 'Pre-screening Completed',  colour: '#0a7c68', order: 7,  active: true  },
  { name: 'Not Qualified',            colour: '#6b7280', order: 8,  active: true  },
  { name: 'Qualified',                colour: '#10b981', order: 9,  active: true  },
  { name: 'No Show',                  colour: '#f97316', order: 10, active: true  },
  { name: 'Opted Out',                colour: '#64748b', order: 11, active: true  },
  { name: 'Withdrawn',                colour: '#f43f5e', order: 12, active: true  },
  { name: 'Study Complete',           colour: '#6366f1', order: 13, active: true  },
];

/* ── Shared Warning Banner ─────────────────────────────────────────── */
function WarnBanner() {
  return (
    <div className="settings-warn">
      <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
      Sensitive setting changes should be treated as audit-aware configuration changes.
    </div>
  );
}

/* ── Password field with show/hide ───────────────────────────────── */
function PasswordField({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="edit-field">
      <label>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder || '••••••••'}
          style={{ paddingRight: 38, width: '100%', boxSizing: 'border-box' }}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0,
          }}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

/* ── Overview Tab ─────────────────────────────────────────────────── */
function OverviewTab() {
  const qc = useQueryClient();
  const { data: staffData } = useQuery({ queryKey: ['staff'], queryFn: () => getStaff().then(r => r.data) });
  const staffList = staffData?.results ?? staffData ?? [];

  const createMutation = useMutation({
    mutationFn: createStaff,
    onSuccess: () => { qc.invalidateQueries(['staff']); setForm(EMPTY_FORM); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateStaff(id, data),
    onSuccess: () => qc.invalidateQueries(['staff']),
  });

  const EMPTY_FORM = { full_name: '', email: '', phone: '', password: '', role: 'staff' };
  const [form, setForm] = useState(EMPTY_FORM);
  const [staffEdits, setStaffEdits] = useState({});

  function getEdit(id, field, fallback) {
    return staffEdits[id]?.[field] ?? fallback;
  }
  function setEdit(id, field, val) {
    setStaffEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  }

  return (
    <>
      {/* Stat grid */}
      <div className="settings-card">
        <div className="settings-card-title">System Overview</div>
        <div className="settings-stat-grid">
          <div className="settings-stat-card">
            <div className="settings-stat-value">{PIPELINE_STAGES.length}</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 4 }}>Pipeline stages</div>
            <div className="settings-stat-sub">Active/archive without destructive delete</div>
          </div>
          <div className="settings-stat-card">
            <div className="settings-stat-value">4</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 4 }}>Templates</div>
            <div className="settings-stat-sub">Approved-template governance</div>
          </div>
          <div className="settings-stat-card">
            <div className="settings-stat-value">8</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 4 }}>Automation rules</div>
            <div className="settings-stat-sub">Timing, stop-if-booked and opt-out safety</div>
          </div>
          <div className="settings-stat-card">
            <div className="settings-stat-value">0</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 4 }}>Automatic channels on</div>
            <div className="settings-stat-sub">SMS and email automation master switches</div>
          </div>
        </div>
      </div>

      {/* Create staff login */}
      <div className="settings-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div className="settings-card-title" style={{ marginBottom: 0 }}>Create staff login</div>
          <span style={{ fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 4, padding: '2px 7px', letterSpacing: '0.05em' }}>ADMIN ONLY</span>
        </div>
        <div className="settings-card-sub">Provision a new CRM user account.</div>
        <form
          className="settings-form"
          onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }}
        >
          <div className="settings-field-row">
            <div className="edit-field">
              <label>Full Name</label>
              <input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Jane Smith" required />
            </div>
            <div className="edit-field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@bioluminux.com" required />
            </div>
          </div>
          <div className="settings-field-row">
            <div className="edit-field">
              <label>Phone</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+44 7700 000000" />
            </div>
            <div className="edit-field">
              <label>Role</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <PasswordField
            label="Password"
            value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
          />
          <div>
            <button type="submit" className="btn-save-settings" disabled={createMutation.isPending}>
              <Plus size={14} /> {createMutation.isPending ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>

      {/* Manage staff */}
      <div className="settings-card">
        <div className="settings-card-title">Manage staff login details</div>
        <div className="settings-card-sub">{staffList.length} staff member{staffList.length !== 1 ? 's' : ''} found.</div>

        {staffList.length === 0 && (
          <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No staff found.</div>
        )}

        {staffList.map(staff => {
          const isSuspended = staff.is_active === false;
          const newPwd = staffEdits[staff.id]?.new_password ?? '';
          return (
            <div key={staff.id} className="settings-staff-row">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={14} color="#64748b" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{staff.full_name || staff.username}</span>
                </div>
                <span className={isSuspended ? 'badge-suspended' : 'badge-active'}>
                  {isSuspended ? 'Suspended' : 'Active'}
                </span>
              </div>
              <div className="settings-staff-grid">
                <div className="edit-field">
                  <label>Full Name</label>
                  <input
                    value={getEdit(staff.id, 'full_name', staff.full_name || '')}
                    onChange={e => setEdit(staff.id, 'full_name', e.target.value)}
                  />
                </div>
                <div className="edit-field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={getEdit(staff.id, 'email', staff.email || '')}
                    onChange={e => setEdit(staff.id, 'email', e.target.value)}
                  />
                </div>
                <div className="edit-field">
                  <label>Phone</label>
                  <input
                    value={getEdit(staff.id, 'phone', staff.phone || '')}
                    onChange={e => setEdit(staff.id, 'phone', e.target.value)}
                  />
                </div>
              </div>
              <div className="settings-staff-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
                <div className="edit-field">
                  <label>Role</label>
                  <select
                    value={getEdit(staff.id, 'role', staff.role || 'staff')}
                    onChange={e => setEdit(staff.id, 'role', e.target.value)}
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
                <PasswordField
                  label="New Password"
                  value={newPwd}
                  onChange={e => setEdit(staff.id, 'new_password', e.target.value)}
                  placeholder="Leave blank to keep"
                />
              </div>
              <div className="settings-staff-actions">
                <button
                  className="btn-save-settings"
                  onClick={() => {
                    const edit = staffEdits[staff.id] || {};
                    const payload = {};
                    if (edit.full_name !== undefined) payload.full_name = edit.full_name;
                    if (edit.email !== undefined) payload.email = edit.email;
                    if (edit.phone !== undefined) payload.phone = edit.phone;
                    if (edit.role !== undefined) payload.role = edit.role;
                    if (edit.new_password) payload.password = edit.new_password;
                    updateMutation.mutate({ id: staff.id, data: payload });
                  }}
                >
                  <Save size={13} /> Save changes
                </button>
                {newPwd && (
                  <button
                    className="btn-blue-sm"
                    onClick={() => updateMutation.mutate({ id: staff.id, data: { password: newPwd } })}
                  >
                    Reset password
                  </button>
                )}
                <button
                  className="btn-blue-sm"
                  onClick={() => updateMutation.mutate({ id: staff.id, data: { is_active: isSuspended } })}
                >
                  {isSuspended ? 'Reinstate' : 'Suspend'}
                </button>
                <button className="btn-danger-sm" onClick={() => updateMutation.mutate({ id: staff.id, data: { is_active: false, revoked: true } })}>
                  Revoke access
                </button>
                <button className="btn-danger-sm" onClick={() => updateMutation.mutate({ id: staff.id, data: { deleted: true } })}>
                  Delete login
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Organisation Tab ─────────────────────────────────────────────── */
function OrganisationTab() {
  const [tz, setTz] = useState(getWorkspaceTz);
  const [fmt, setFmt] = useState(getDateFormat);
  const [orgSaved, setOrgSaved] = useState(false);
  const [wsSaved, setWsSaved] = useState(false);
  const [orgName, setOrgName] = useState(() => localStorage.getItem('org_name') || 'Bioluminux Wolverhampton');
  const [contactEmail, setContactEmail] = useState(() => localStorage.getItem('org_contact_email') || '');
  const [defaultPhone, setDefaultPhone] = useState(() => localStorage.getItem('org_default_phone') || '');
  const [websiteUrl, setWebsiteUrl] = useState(() => localStorage.getItem('org_website') || '');

  function saveOrg(e) {
    e.preventDefault();
    localStorage.setItem('org_name', orgName);
    localStorage.setItem('org_contact_email', contactEmail);
    localStorage.setItem('org_default_phone', defaultPhone);
    localStorage.setItem('org_website', websiteUrl);
    setOrgSaved(true);
    setTimeout(() => setOrgSaved(false), 2500);
  }

  function saveWorkspace(e) {
    e.preventDefault();
    setWorkspaceTz(tz);
    setDateFormat(fmt);
    setWsSaved(true);
    setTimeout(() => setWsSaved(false), 2500);
  }

  return (
    <>
      <WarnBanner />

      {/* Organisation Profile */}
      <div className="settings-card">
        <div className="settings-card-title">Organisation Profile</div>
        <div className="settings-card-sub">Core organisation identity used across the CRM.</div>
        <form className="settings-form" onSubmit={saveOrg}>
          <div className="settings-field-row">
            <div className="edit-field">
              <label>Organisation Name</label>
              <input value={orgName} onChange={e => setOrgName(e.target.value)} />
            </div>
            <div className="edit-field">
              <label>Website URL</label>
              <input type="url" placeholder="https://bioluminux.com" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} />
            </div>
          </div>
          <div className="settings-field-row">
            <div className="edit-field">
              <label>Default Contact Email</label>
              <input type="email" placeholder="contact@bioluminux.com" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
            </div>
            <div className="edit-field">
              <label>Default Phone</label>
              <input type="tel" placeholder="+44 7700 000000" value={defaultPhone} onChange={e => setDefaultPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <button type="submit" className="btn-save-settings">
              <Save size={14} /> {orgSaved ? 'Saved!' : 'Save Organisation'}
            </button>
          </div>
        </form>
      </div>

      {/* Workspace Settings */}
      <div className="settings-card">
        <div className="settings-card-title">Workspace Settings</div>
        <div className="settings-card-sub">Controls how dates and times are displayed across the CRM.</div>
        <form className="settings-form" onSubmit={saveWorkspace}>
          <div className="edit-field">
            <label>Timezone</label>
            <TimezoneSelect value={tz} onChange={setTz} />
          </div>
          <div className="edit-field">
            <label>Date Format</label>
            <select value={fmt} onChange={e => setFmt(e.target.value)}>
              <option value="GB">DD/MM/YYYY</option>
              <option value="US">MM/DD/YYYY</option>
              <option value="ISO">YYYY-MM-DD</option>
            </select>
          </div>
          <div>
            <button type="submit" className="btn-save-settings">
              <Save size={14} /> {wsSaved ? 'Saved!' : 'Save Workspace Settings'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

/* ── Pipeline Tab ─────────────────────────────────────────────────── */
function PipelineTab() {
  const qc = useQueryClient();
  const [pipelineSaved, setPipelineSaved] = useState(false);

  const { data: apiStages, isLoading } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: () => getPipelineStages().then(r => r.data),
  });

  const [stages, setStages] = useState([]);

  useEffect(() => {
    if (apiStages) setStages(apiStages);
  }, [apiStages]);

  const saveMutation = useMutation({
    mutationFn: () => savePipelineStages(stages),
    onSuccess: (r) => {
      qc.setQueryData(['pipeline-stages'], r.data);
      setStages(r.data);
      setPipelineSaved(true);
      setTimeout(() => setPipelineSaved(false), 2500);
    },
  });

  function update(id, field, value) {
    setStages(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  return (
    <>
      <WarnBanner />
      <div className="settings-card">
        <div className="settings-card-title">Pipeline Stages</div>
        <div className="settings-card-sub">13 stages — edit names, colours and order. Archive instead of delete.</div>

        <div style={{ marginTop: 8 }}>
          {/* Header row */}
          <div className="settings-stage-row" style={{ background: 'none', padding: '0 10px', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>STAGE NAME</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>COLOUR</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>ORDER</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>ACTIVE</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>ARCHIVE</span>
          </div>

          {stages.map(s => (
            <div key={s.id} className="settings-stage-row" style={{ opacity: s.is_archived ? 0.45 : 1 }}>
              <input
                value={s.name}
                onChange={e => update(s.id, 'name', e.target.value)}
                style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: '#1e293b', fontFamily: 'inherit', background: '#fff' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  value={s.colour}
                  onChange={e => update(s.id, 'colour', e.target.value)}
                  style={{ width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2, background: 'none' }}
                />
                <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{s.colour}</span>
              </div>
              <input
                type="number"
                value={s.order}
                onChange={e => update(s.id, 'order', Number(e.target.value))}
                style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: '#1e293b', fontFamily: 'inherit', background: '#fff', width: '100%', boxSizing: 'border-box' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <input
                  type="checkbox"
                  checked={s.is_active}
                  onChange={e => update(s.id, 'is_active', e.target.checked)}
                  style={{ accentColor: '#0a7c68', width: 16, height: 16 }}
                />
              </label>
              <button
                className={s.is_archived ? 'btn-blue-sm' : 'btn-danger-sm'}
                onClick={() => update(s.id, 'is_archived', !s.is_archived)}
              >
                {s.is_archived ? 'Restore' : 'Archive'}
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <button
            className="btn-save-settings"
            disabled={saveMutation.isPending || isLoading}
            onClick={() => saveMutation.mutate()}
          >
            <Save size={14} /> {pipelineSaved ? 'Saved!' : saveMutation.isPending ? 'Saving…' : 'Save Pipeline Stages'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Templates Tab ────────────────────────────────────────────────── */
function TemplatesTab() {
  return (
    <>
      <WarnBanner />
      <div className="settings-card">
        <div className="settings-card-title">Template Governance</div>
        <div className="settings-card-sub">4 approved templates configured.</div>
        <div className="settings-placeholder-card">
          <div className="settings-placeholder-title">Facebook Study Message Pairs</div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            Template governance managed via Facebook study message pairs. Connect study names to Meta ad names for automated sending.
          </p>
          <div className="settings-placeholder-note">Connect to templates table to enable editing</div>
        </div>
        <div className="settings-placeholder-card">
          <div className="settings-placeholder-title">Study Folder: COPD Study 2025</div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Template 1 of 2 · Initial outreach · Approved</p>
        </div>
        <div className="settings-placeholder-card">
          <div className="settings-placeholder-title">Study Folder: Diabetes Screening</div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Template 1 of 2 · Initial outreach · Approved</p>
        </div>
      </div>
    </>
  );
}

/* ── Automation Tab ───────────────────────────────────────────────── */
function AutomationTab() {
  const tiles = [
    { title: 'Auto-message timing', note: 'Configure delay after lead creation before first automated message.' },
    { title: 'Stop-if-booked rules', note: 'Halt automation sequence once a booking is confirmed.' },
    { title: 'Opt-out enforcement', note: 'Ensure opted-out contacts are excluded from all sequences.' },
    { title: 'Callback scheduling', note: 'Set callback delay windows for unreached leads.' },
  ];

  return (
    <>
      <WarnBanner />
      <div className="settings-card">
        <div className="settings-card-title">Automation Rules</div>
        <div className="settings-card-sub">8 rules currently configured.</div>
        <div className="settings-placeholder-card" style={{ marginBottom: 20 }}>
          <div className="settings-placeholder-title">Connect to automation_jobs table</div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            8 automation rules configured. Connect to automation_jobs table to edit timing and trigger conditions.
          </p>
          <div className="settings-placeholder-note">Requires automation_jobs backend endpoint</div>
        </div>
        <div className="settings-stat-grid">
          {tiles.map(t => (
            <div key={t.title} className="settings-stat-card">
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 6 }}>{t.title}</div>
              <div className="settings-stat-sub">{t.note}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── Booking Tab ──────────────────────────────────────────────────── */
function BookingTab() {
  const cards = [
    { title: 'Appointment duration', note: 'Create booking_settings table to persist appointment length configuration.' },
    { title: 'Available days and times', note: 'Create availability_windows table to define bookable slots per staff member.' },
    { title: 'Reminder timing', note: 'Persist reminder offsets (e.g. 24h, 1h before) per appointment type.' },
  ];

  return (
    <div className="settings-card">
      <div className="settings-card-title">Booking Configuration</div>
      <div className="settings-card-sub">Appointment, availability and reminder settings.</div>
      {cards.map(c => (
        <div key={c.title} className="settings-placeholder-card">
          <div className="settings-placeholder-title">{c.title}</div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{c.note}</p>
          <div className="settings-placeholder-note">Pending backend table</div>
        </div>
      ))}
    </div>
  );
}

/* ── Notifications Tab ────────────────────────────────────────────── */
function NotificationsTab() {
  const cards = [
    { title: 'Overdue alerts', note: 'Create notification_preferences table to persist per-user overdue alert settings.' },
    { title: 'New lead alerts', note: 'Persist per-role notification settings for incoming lead assignment alerts.' },
    { title: 'Failed message alerts', note: 'Persist failed-message notification rules per staff member and channel.' },
  ];

  return (
    <div className="settings-card">
      <div className="settings-card-title">Notification Preferences</div>
      <div className="settings-card-sub">Alert and notification configuration for all staff roles.</div>
      {cards.map(c => (
        <div key={c.title} className="settings-placeholder-card">
          <div className="settings-placeholder-title">{c.title}</div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{c.note}</p>
          <div className="settings-placeholder-note">Pending backend table</div>
        </div>
      ))}
    </div>
  );
}

/* ── Root Settings Page ───────────────────────────────────────────── */
export default function Settings() {
  const [activeTab, setActiveTab] = useState('overview');

  const TAB_CONTENT = {
    overview:      <OverviewTab />,
    organisation:  <OrganisationTab />,
    pipeline:      <PipelineTab />,
    templates:     <TemplatesTab />,
    automation:    <AutomationTab />,
    booking:       <BookingTab />,
    notifications: <NotificationsTab />,
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">CRM configuration and administration</p>
        </div>
      </div>

      <div className="settings-layout">
        {/* Left sidenav */}
        <aside className="settings-sidenav">
          <div className="settings-sidenav-title">CRM SETTINGS</div>
          <div className="settings-sidenav-sub">Configure operational communication workflows.</div>
          {NAV_ITEMS.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`settings-nav-item ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
          <div style={{ marginTop: 'auto', paddingTop: 20 }}>
            <div style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={11} color="#475569" />
              Admin/manager settings access
            </div>
          </div>
        </aside>

        {/* Right content */}
        <motion.div
          key={activeTab}
          className="settings-content"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18 }}
        >
          {TAB_CONTENT[activeTab]}
        </motion.div>
      </div>
    </div>
  );
}
