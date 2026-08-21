import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCog, Plus, X, Activity, PhoneCall, AlertTriangle,
  TrendingUp, Eye, Shield, Mail, Phone, ChevronRight
} from 'lucide-react';
import { getStaff, createStaff, updateStaff } from '../api';
import { BioLoaderPage } from '../components/ui/BioLoader';
import './Staff.css';

const ROLE_BADGE = {
  admin: 'role-badge-admin',
  staff: 'role-badge-staff',
  manager: 'role-badge-admin',
  recruiter: 'role-badge-staff',
  viewer: 'role-badge-staff',
};

function avg(arr, field) {
  if (!arr.length) return '0%';
  const vals = arr.map(s => parseFloat(s[field] || 0));
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(0) + '%';
}

function sum(arr, field) {
  return arr.reduce((a, s) => a + (parseInt(s[field] || 0)), 0);
}

export default function Staff() {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [viewStaff, setViewStaff] = useState(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', role: 'staff', password: '' });
  const [showPwd, setShowPwd] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => getStaff().then(r => r.data.results || r.data),
  });

  const createMut = useMutation({
    mutationFn: createStaff,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      setShowInvite(false);
      setForm({ first_name: '', last_name: '', email: '', phone: '', role: 'staff', password: '' });
    },
  });

  const staff = data || [];
  const activeStaff = staff.filter(s => s.is_active !== false);
  const totalCalls = sum(staff, 'calls_count');
  const overdueTasks = sum(staff, 'overdue_tasks_count');
  const bookingAvg = avg(staff, 'booking_conversion');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (isLoading) return <BioLoaderPage text="Loading…" />;

  const kpis = [
    { label: 'Active Staff', value: activeStaff.length, sub: `${staff.length} total profiles`, icon: UserCog, cls: 'kpi-navy' },
    { label: 'Calls Made', value: totalCalls, sub: 'Across visible staff records', icon: PhoneCall, cls: 'kpi-blue' },
    { label: 'Overdue Tasks', value: overdueTasks, sub: 'Assigned tasks past due', icon: AlertTriangle, cls: 'kpi-teal' },
    { label: 'Avg Booking Conversion', value: bookingAvg, sub: 'Average across assigned leads', icon: TrendingUp, cls: 'kpi-cyan' },
  ];

  return (
    <div className="staff-page">
      {/* Page header card */}
      <div className="staff-header-card">
        <div className="staff-header-left">
          <div className="staff-header-icon"><UserCog size={22} strokeWidth={1.8} /></div>
          <div>
            <h1 className="staff-header-title">Staff Management</h1>
            <p className="staff-header-sub">Role-aware team directory, active status, assigned work and operational performance.</p>
          </div>
        </div>
        <div className="staff-header-badges">
          <span className="header-badge-pill">Admin controls</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="staff-kpi-grid">
        {kpis.map(k => (
          <div key={k.label} className={`staff-kpi-card ${k.cls}`}>
            <div>
              <div className="staff-kpi-label">{k.label}</div>
              <div className="staff-kpi-value">{k.value}</div>
              <div className="staff-kpi-sub">{k.sub}</div>
            </div>
            <div className="staff-kpi-icon-wrap"><k.icon size={24} strokeWidth={1.5} /></div>
          </div>
        ))}
      </div>

      {/* Directory card */}
      <div className="staff-directory-card">
        <div className="staff-directory-header">
          <div>
            <h2 className="staff-directory-title">Team directory</h2>
            <p className="staff-directory-sub">Staff are managed from the Django backend. Invitation flow requires backend support.</p>
          </div>
          <button className="invite-member-btn" onClick={() => setShowInvite(true)}>
            <Plus size={15} /> Invite member
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Loading staff...</div>
        ) : (
          <table className="staff-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Leads</th>
                <th>Tasks</th>
                <th>Overdue</th>
                <th>Calls</th>
                <th>Booking</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => {
                const initials = `${s.first_name?.[0] || ''}${s.last_name?.[0] || ''}`.toUpperCase() || 'U';
                const fullName = s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim();
                const isActive = s.is_active !== false;
                const roleCls = ROLE_BADGE[s.role] || 'role-badge-staff';
                const overdue = parseInt(s.overdue_tasks_count || 0);
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="staff-member-cell">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="staff-table-avatar">{initials}</div>
                          <div>
                            <div className="staff-member-name">{fullName}</div>
                            <div className="staff-member-email">{s.email}</div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`role-badge-pill ${roleCls}`}>
                        <Shield size={10} /> {s.role || 'staff'}
                      </span>
                    </td>
                    <td>
                      <span className={isActive ? 'status-badge-active' : 'status-badge-suspended'}>
                        {isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="staff-td-num">{s.leads_count || 0}</td>
                    <td className="staff-td-num">{s.tasks_count || 0}</td>
                    <td className="staff-td-num">
                      <span className={overdue > 0 ? 'overdue-count-red' : 'overdue-count-ok'}>{overdue}</span>
                    </td>
                    <td className="staff-td-num">{s.calls_count || 0}</td>
                    <td className="staff-td-num">{s.booking_conversion ? `${parseFloat(s.booking_conversion).toFixed(0)}%` : '0%'}</td>
                    <td>
                      <button className="view-staff-btn" onClick={() => setViewStaff(s)}>
                        View <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                    No staff members found. Invite someone to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite modal */}
      <AnimatePresence>
        {showInvite && (
          <>
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowInvite(false)} />
            <motion.div className="staff-modal" initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
              <div className="staff-modal-header">
                <h3>Invite member</h3>
                <button onClick={() => setShowInvite(false)} className="modal-close"><X size={16} /></button>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Creates a new staff account in the system.</p>
              <div className="staff-invite-grid">
                <div className="edit-field"><label>First Name</label><input value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Jane" /></div>
                <div className="edit-field"><label>Last Name</label><input value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Smith" /></div>
                <div className="edit-field"><label>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@bioluminux.com" /></div>
                <div className="edit-field"><label>Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+44 7700 000000" /></div>
                <div className="edit-field">
                  <label>Role</label>
                  <select value={form.role} onChange={e => set('role', e.target.value)}>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                <div className="edit-field">
                  <label>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPwd ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 8 characters" style={{ width: '100%', paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>
                      {showPwd ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>
              {createMut.isError && <p style={{ color: '#dc2626', fontSize: 12, marginBottom: 12 }}>Failed to create staff. Check all fields.</p>}
              <div className="staff-modal-footer">
                <button className="btn-ghost" onClick={() => setShowInvite(false)}>Cancel</button>
                <button className="invite-member-btn" onClick={() => createMut.mutate(form)} disabled={createMut.isPending}>
                  {createMut.isPending ? 'Creating...' : 'Create member'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* View staff detail modal */}
      <AnimatePresence>
        {viewStaff && (
          <>
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewStaff(null)} />
            <motion.div className="staff-modal" initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
              <div className="staff-modal-header">
                <h3>Staff Profile</h3>
                <button onClick={() => setViewStaff(null)} className="modal-close"><X size={16} /></button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: '16px', background: '#f8fafc', borderRadius: 10 }}>
                <div className="staff-detail-avatar">
                  {`${viewStaff.first_name?.[0] || ''}${viewStaff.last_name?.[0] || ''}`.toUpperCase() || 'U'}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{viewStaff.full_name || `${viewStaff.first_name} ${viewStaff.last_name}`}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{viewStaff.email}</div>
                  <span className={`role-badge-pill ${ROLE_BADGE[viewStaff.role] || 'role-badge-staff'}`} style={{ marginTop: 6, display: 'inline-flex' }}>
                    <Shield size={10} /> {viewStaff.role}
                  </span>
                </div>
              </div>
              <div className="staff-detail-grid">
                {[
                  ['Phone', viewStaff.phone || '—'],
                  ['Status', viewStaff.is_active !== false ? 'Active' : 'Suspended'],
                  ['Leads assigned', viewStaff.leads_count || 0],
                  ['Tasks', viewStaff.tasks_count || 0],
                  ['Calls made', viewStaff.calls_count || 0],
                  ['Booking conversion', viewStaff.booking_conversion ? `${parseFloat(viewStaff.booking_conversion).toFixed(0)}%` : '0%'],
                ].map(([label, val]) => (
                  <div key={label} className="staff-detail-field">
                    <div className="staff-detail-label">{label}</div>
                    <div className="staff-detail-value">{val}</div>
                  </div>
                ))}
              </div>
              <div className="staff-modal-footer">
                <button className="btn-ghost" onClick={() => setViewStaff(null)}>Close</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
