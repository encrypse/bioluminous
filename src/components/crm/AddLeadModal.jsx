import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Phone, Mail, MapPin, Briefcase, AlertCircle } from 'lucide-react';
import { createParticipant, getCampaigns } from '../../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BioLoaderInline } from '../ui/BioLoader';
import './AddLeadModal.css';

const SOURCES = [
  { key: 'manual',   label: 'Manual Entry' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'website',  label: 'Website' },
  { key: 'import',   label: 'Import' },
  { key: 'referral', label: 'Referral' },
];

function fieldErrors(err) {
  const data = err?.response?.data;
  if (!data) return {};
  if (typeof data === 'object' && !Array.isArray(data)) return data;
  return {};
}

export default function AddLeadModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', postcode_city: '',
    source: 'manual', campaign_id: '', notes: '',
  });
  const [errors, setErrors] = useState({});

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => getCampaigns().then(r => r.data.results || r.data),
  });

  const mutation = useMutation({
    mutationFn: (data) => createParticipant(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['participants'] });
      onClose();
    },
    onError: (e) => {
      const fe = fieldErrors(e);
      setErrors(fe);
    },
  });

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(prev => ({ ...prev, [k]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!form.phone.trim()) errs.phone = 'Phone number is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      source: form.source,
      notes: form.notes,
    };
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.postcode_city.trim()) payload.postcode_city = form.postcode_city.trim();
    if (form.campaign_id) payload.campaign_id = form.campaign_id;

    mutation.mutate(payload);
  };

  const globalError = errors?.detail || errors?.non_field_errors?.[0];

  return (
    <AnimatePresence>
      <div className="modal-backdrop" onClick={onClose}>
        <motion.div
          className="modal-box"
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 32, scale: 0.96 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-header">
            <div>
              <h2 className="modal-title">Add New Lead</h2>
              <p className="modal-sub">Participant will be placed in New Lead stage</p>
            </div>
            <button className="modal-close" onClick={onClose}><X size={18} /></button>
          </div>

          <form className="modal-form" onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <div className={`form-field full ${errors.name ? 'has-error' : ''}`}>
                <label>Full Name <span className="req">*</span></label>
                <div className="input-wrap">
                  <User size={14} />
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" />
                </div>
                {errors.name && <span className="field-error">{Array.isArray(errors.name) ? errors.name[0] : errors.name}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className={`form-field ${errors.phone ? 'has-error' : ''}`}>
                <label>Phone <span className="req">*</span></label>
                <div className="input-wrap">
                  <Phone size={14} />
                  <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+44 7700 900000" />
                </div>
                {errors.phone && <span className="field-error">{Array.isArray(errors.phone) ? errors.phone[0] : errors.phone}</span>}
              </div>
              <div className={`form-field ${errors.email ? 'has-error' : ''}`}>
                <label>Email</label>
                <div className="input-wrap">
                  <Mail size={14} />
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" />
                </div>
                {errors.email && <span className="field-error">{Array.isArray(errors.email) ? errors.email[0] : errors.email}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className={`form-field ${errors.source ? 'has-error' : ''}`}>
                <label>Source</label>
                <div className="input-wrap select-wrap">
                  <select value={form.source} onChange={e => set('source', e.target.value)}>
                    {SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                {errors.source && <span className="field-error">{Array.isArray(errors.source) ? errors.source[0] : errors.source}</span>}
              </div>
              <div className="form-field">
                <label>Campaign</label>
                <div className="input-wrap select-wrap">
                  <Briefcase size={14} />
                  <select value={form.campaign_id} onChange={e => set('campaign_id', e.target.value)}>
                    <option value="">No campaign</option>
                    {campaigns?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="form-field">
              <label>Postcode / City</label>
              <div className="input-wrap">
                <MapPin size={14} />
                <input value={form.postcode_city} onChange={e => set('postcode_city', e.target.value)} placeholder="WV1 1AA" />
              </div>
            </div>

            <div className="form-field">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any initial notes..." rows={3} />
            </div>

            {globalError && (
              <div className="form-error-banner">
                <AlertCircle size={14} /> {globalError}
              </div>
            )}

            <div className="modal-footer">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={mutation.isPending}>
                {mutation.isPending ? <><BioLoaderInline /> Adding…</> : 'Add Lead'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
