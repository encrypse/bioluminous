import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Plus, Search, Download, Printer, Eye, X, Check,
  AlertCircle, Clock, TrendingUp, ChevronDown,
  Trash2, CreditCard, Hash, Calendar,
  User, Send, CheckCircle, XCircle, Receipt
} from 'lucide-react';
import {
  getInvoices, createInvoice, updateInvoice, markInvoicePaid,
  getBillingStats, getReceipts, getParticipants, getStudies,
} from '../api';
import { humanize } from '../utils/humanize';
import { BioLoaderPage } from '../components/ui/BioLoader';
import './Billing.css';

const STATUS_META = {
  draft:     { label: 'Draft',           color: '#6b7280', bg: '#f3f4f6',  icon: FileText },
  sent:      { label: 'Sent',            color: '#3b82f6', bg: '#eff6ff',  icon: Send },
  paid:      { label: 'Paid',            color: '#16a34a', bg: '#dcfce7',  icon: CheckCircle },
  overdue:   { label: 'Overdue',         color: '#dc2626', bg: '#fef2f2',  icon: AlertCircle },
  cancelled: { label: 'Cancelled',       color: '#9f1239', bg: '#fff1f2',  icon: XCircle },
  partial:   { label: 'Partially Paid',  color: '#d97706', bg: '#fef3c7',  icon: Clock },
};

const SERVICE_PRESETS = [
  { name: 'Pre-Screening Visit',        rate: 150.00 },
  { name: 'Screening Visit',            rate: 350.00 },
  { name: 'Follow-up Visit',            rate: 120.00 },
  { name: 'Blood Draw / Sample Collection', rate: 75.00 },
  { name: 'Medical Assessment',         rate: 200.00 },
  { name: 'ECG Recording',             rate: 80.00 },
  { name: 'Administration Fee',         rate: 50.00 },
  { name: 'Travel Reimbursement',       rate: 0.00 },
  { name: 'Participant Compensation',   rate: 0.00 },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtGBP(n) { return `£${(+n || 0).toFixed(2)}`; }

export default function Billing() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [viewReceipt, setViewReceipt] = useState(null);
  const [markPaidInvoice, setMarkPaidInvoice] = useState(null);

  const { data: statsData } = useQuery({
    queryKey: ['billing-stats'],
    queryFn: () => getBillingStats().then(r => r.data),
  });

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', { status: filter !== 'all' ? filter : undefined, search }],
    queryFn: () => getInvoices({ status: filter !== 'all' ? filter : undefined, search }).then(r => r.data.results || r.data),
    keepPreviousData: true,
  });

  const markSentMutation = useMutation({
    mutationFn: (id) => updateInvoice(id, { status: 'sent' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['billing-stats'] }); },
  });

  const invoices = invoicesData || [];
  const stats = statsData || {};

  const filtered = invoices.filter(inv => {
    if (!search) return true;
    const q = search.toLowerCase();
    return inv.invoice_number?.toLowerCase().includes(q) || inv.participant_name?.toLowerCase().includes(q) || inv.study_reference?.toLowerCase().includes(q);
  });

  return (
    <div className="billing-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing & Payments</h1>
          <p className="page-sub">{invoices.length} invoices · Medical billing, receipts and payment records</p>
        </div>
        <div className="billing-header-actions">
          <button className="btn-outline-sm"><Download size={14} /> Export</button>
          <button className="btn-primary-sm" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> New Invoice
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="billing-kpi">
        {[
          { label: 'Total Invoiced',  value: fmtGBP(stats.total_invoiced || 0),    icon: FileText,    color: '#2a9c5c', sub: `${stats.invoice_count || 0} invoices` },
          { label: 'Collected',       value: fmtGBP(stats.total_paid || 0),         icon: CheckCircle, color: '#16a34a', sub: `${stats.paid_count || 0} paid in full` },
          { label: 'Outstanding',     value: fmtGBP(stats.total_outstanding || 0),  icon: Clock,       color: '#3b82f6', sub: 'Awaiting payment' },
          { label: 'Overdue',         value: fmtGBP(stats.total_overdue || 0),      icon: AlertCircle, color: '#dc2626', sub: `${stats.overdue_count || 0} overdue` },
        ].map((k, i) => (
          <motion.div key={k.label} className="billing-kpi-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <div className="billing-kpi-icon" style={{ background: `${k.color}18`, color: k.color }}><k.icon size={18} /></div>
            <div>
              <div className="billing-kpi-value">{k.value}</div>
              <div className="billing-kpi-label">{k.label}</div>
              <div className="billing-kpi-sub">{k.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="billing-toolbar">
        <div className="billing-search">
          <Search size={14} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice #, participant, study…" />
        </div>
        <div className="billing-status-tabs">
          {['all', 'draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'].map(s => (
            <button key={s} className={`billing-tab ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
              {s === 'all' ? 'All' : STATUS_META[s]?.label || humanize(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Table */}
      <div className="billing-table-wrap">
        {isLoading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading invoices…</div>
        ) : (
          <table className="billing-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Participant</th>
                <th>Study</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, i) => {
                const sm = STATUS_META[inv.status] || STATUS_META.draft;
                return (
                  <motion.tr key={inv.id} className="billing-row" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <td><span className="inv-id">{inv.invoice_number}</span></td>
                    <td>
                      <div className="inv-participant">
                        <div className="inv-avatar">{inv.participant_name?.[0] || '?'}</div>
                        {inv.participant_name}
                      </div>
                    </td>
                    <td><span className="inv-study">{inv.study_reference || '—'}</span></td>
                    <td><span className="inv-items-count">{inv.item_count || 0} item{inv.item_count !== 1 ? 's' : ''}</span></td>
                    <td>
                      <div className="inv-amount-cell">
                        <span className="inv-amount">{fmtGBP(inv.total)}</span>
                        {inv.status === 'partial' && <span className="inv-paid-hint">({fmtGBP(inv.paid_amount)} paid)</span>}
                      </div>
                    </td>
                    <td>
                      <span className="inv-status-badge" style={{ background: sm.bg, color: sm.color }}>
                        <sm.icon size={11} /> {sm.label}
                      </span>
                    </td>
                    <td className="inv-date">{fmtDate(inv.issued_at)}</td>
                    <td className={`inv-date ${inv.status === 'overdue' ? 'overdue' : ''}`}>{fmtDate(inv.due_at)}</td>
                    <td>
                      <div className="inv-actions">
                        <button className="inv-action-btn" title="View Invoice" onClick={() => setViewInvoice(inv)}><Eye size={13} /></button>
                        {inv.status === 'paid' && (
                          <button className="inv-action-btn" title="View Receipt" onClick={() => setViewReceipt(inv)}><Receipt size={13} /></button>
                        )}
                        {inv.status === 'draft' && (
                          <button className="inv-action-btn" title="Mark as Sent" onClick={() => markSentMutation.mutate(inv.id)}><Send size={13} /></button>
                        )}
                        {['sent', 'overdue', 'partial'].includes(inv.status) && (
                          <button className="inv-action-btn success" title="Record Payment" onClick={() => setMarkPaidInvoice(inv)}><Check size={13} /></button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
              {filtered.length === 0 && !isLoading && (
                <tr><td colSpan={9} className="billing-empty">
                  {invoices.length === 0 ? 'No invoices yet. Create your first invoice.' : 'No invoices match your filter.'}
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['billing-stats'] }); setShowCreate(false); }} />}
      </AnimatePresence>

      <AnimatePresence>
        {viewInvoice && <InvoicePrintModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {viewReceipt && <ReceiptPrintModal invoice={viewReceipt} onClose={() => setViewReceipt(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {markPaidInvoice && (
          <MarkPaidModal
            invoice={markPaidInvoice}
            onClose={() => setMarkPaidInvoice(null)}
            onSuccess={() => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['billing-stats'] }); setMarkPaidInvoice(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateInvoiceModal({ onClose, onSuccess }) {
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantDropdown, setParticipantDropdown] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_rate: 0.00 }]);
  const [form, setForm] = useState({
    study_reference: '',
    issued_at: new Date().toISOString().split('T')[0],
    due_at: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    notes: '', vat_rate: 0, status: 'draft',
  });
  const [errors, setErrors] = useState({});

  const { data: participantResults } = useQuery({
    queryKey: ['participants', { search: participantSearch }],
    queryFn: () => getParticipants({ search: participantSearch, page_size: 8 }).then(r => r.data.results || r.data),
    enabled: participantSearch.length >= 2,
  });

  const { data: studiesData } = useQuery({
    queryKey: ['studies'],
    queryFn: () => getStudies({ page_size: 100 }).then(r => r.data.results ?? r.data),
  });
  const studies = studiesData || [];

  const mutation = useMutation({
    mutationFn: createInvoice,
    onSuccess,
    onError: (err) => setErrors(err.response?.data || { detail: 'Failed to create invoice' }),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const subtotal = items.reduce((s, it) => s + ((+it.quantity || 0) * (+it.unit_rate || 0)), 0);
  const vat = subtotal * (form.vat_rate / 100);
  const total = subtotal + vat;

  const addItem = () => setItems(prev => [...prev, { description: '', quantity: 1, unit_rate: 0.00 }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const setItem = (idx, field, val) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));

  const handleSubmit = () => {
    if (!selectedParticipant) { setErrors({ detail: 'Select a participant first.' }); return; }
    mutation.mutate({
      participant_id: selectedParticipant.id,
      study_reference: form.study_reference,
      issued_at: form.issued_at,
      due_at: form.due_at,
      notes: form.notes,
      vat_rate: form.vat_rate,
      status: form.status,
      items: items.filter(i => i.description),
    });
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="billing-modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()}>
        <div className="billing-modal-header">
          <div><h2>New Invoice</h2><p>Create a medical billing invoice</p></div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="billing-modal-body">
          {errors.detail && <div className="form-error-banner"><AlertCircle size={13} /> {errors.detail}</div>}

          {/* Participant */}
          <div className="billing-form-section">
            <h4 className="billing-section-title"><User size={13} /> Patient / Participant</h4>
            <div className="billing-participant-search">
              <div className="billing-search">
                <Search size={13} />
                <input
                  value={selectedParticipant ? selectedParticipant.name : participantSearch}
                  onChange={e => { setParticipantSearch(e.target.value); setSelectedParticipant(null); setParticipantDropdown(true); }}
                  placeholder="Search participant by name or phone…"
                  onFocus={() => setParticipantDropdown(true)}
                />
                {selectedParticipant && <Check size={14} style={{ color: '#16a34a', marginRight: 8 }} />}
              </div>
              {participantDropdown && (participantResults?.length || 0) > 0 && !selectedParticipant && (
                <div className="participant-dropdown">
                  {participantResults.map(p => (
                    <div key={p.id} className="participant-drop-item" onClick={() => { setSelectedParticipant(p); setParticipantSearch(p.name); setParticipantDropdown(false); }}>
                      <div className="pdrop-avatar">{p.initials || p.name?.[0]}</div>
                      <div><div className="pdrop-name">{p.name}</div><div className="pdrop-sub">{p.phone} · {humanize(p.stage)}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Invoice Details */}
          <div className="billing-form-section">
            <h4 className="billing-section-title"><Hash size={13} /> Invoice Details</h4>
            <div className="billing-form-grid-3">
              <div className="edit-field">
                <label>Study / Reference</label>
                <select value={form.study_reference} onChange={e => set('study_reference', e.target.value)}>
                  <option value="">— No study —</option>
                  {studies.map(s => (
                    <option key={s.id} value={s.protocol_id}>
                      {s.protocol_id} — {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="edit-field">
                <label>Issue Date</label>
                <input type="date" value={form.issued_at} onChange={e => set('issued_at', e.target.value)} />
              </div>
              <div className="edit-field">
                <label>Due Date</label>
                <input type="date" value={form.due_at} onChange={e => set('due_at', e.target.value)} />
              </div>
            </div>
            <div className="billing-form-grid-3">
              <div className="edit-field">
                <label>VAT Rate</label>
                <select value={form.vat_rate} onChange={e => set('vat_rate', +e.target.value)}>
                  <option value={0}>0% (Exempt)</option>
                  <option value={5}>5% (Reduced)</option>
                  <option value={20}>20% (Standard)</option>
                </select>
              </div>
              <div className="edit-field">
                <label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="draft">Save as Draft</option>
                  <option value="sent">Send Immediately</option>
                </select>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="billing-form-section">
            <div className="billing-section-header">
              <h4 className="billing-section-title"><FileText size={13} /> Services / Line Items</h4>
              <button className="btn-ghost-sm" onClick={addItem}><Plus size={12} /> Add Row</button>
            </div>
            <div className="line-items-table">
              <div className="line-items-head"><span>Description</span><span>Qty</span><span>Rate (£)</span><span>Amount</span><span></span></div>
              {items.map((item, idx) => (
                <div key={idx} className="line-item-row">
                  <div>
                    <input className="li-desc" value={item.description} onChange={e => setItem(idx, 'description', e.target.value)} placeholder="Service description…" list={`presets-${idx}`} />
                    <datalist id={`presets-${idx}`}>{SERVICE_PRESETS.map(p => <option key={p.name} value={p.name} />)}</datalist>
                  </div>
                  <input className="li-qty" type="number" min={1} value={item.quantity} onChange={e => setItem(idx, 'quantity', +e.target.value)} />
                  <input className="li-rate" type="number" step="0.01" min={0} value={item.unit_rate} onChange={e => setItem(idx, 'unit_rate', +e.target.value)} />
                  <span className="li-amount">{fmtGBP(item.quantity * item.unit_rate)}</span>
                  <button className="li-remove" onClick={() => removeItem(idx)} disabled={items.length === 1}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
            <div className="preset-chips">
              {SERVICE_PRESETS.slice(0, 5).map(p => (
                <button key={p.name} className="preset-chip" onClick={() => setItems(prev => [...prev, { description: p.name, quantity: 1, unit_rate: p.rate }])}>+ {p.name}</button>
              ))}
            </div>
            <div className="invoice-totals">
              <div className="invoice-total-row"><span>Subtotal</span><span>{fmtGBP(subtotal)}</span></div>
              {form.vat_rate > 0 && <div className="invoice-total-row"><span>VAT ({form.vat_rate}%)</span><span>{fmtGBP(vat)}</span></div>}
              <div className="invoice-total-row grand"><span>Total</span><span>{fmtGBP(total)}</span></div>
            </div>
          </div>

          <div className="billing-form-section">
            <h4 className="billing-section-title">Notes / Payment Terms</h4>
            <textarea rows={3} className="billing-notes" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Payment terms, bank details, additional notes…" />
          </div>
        </div>

        <div className="billing-modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={mutation.isPending || !selectedParticipant}>
            {mutation.isPending ? 'Creating…' : <><FileText size={14} /> Create Invoice</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MarkPaidModal({ invoice, onClose, onSuccess }) {
  const [form, setForm] = useState({
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    amount: invoice.balance_due || invoice.total,
    reference: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (data) => markInvoicePaid(invoice.id, data),
    onSuccess,
    onError: (err) => setErrors(err.response?.data || { detail: 'Payment recording failed' }),
  });

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="billing-modal" style={{ width: 480 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
        <div className="billing-modal-header">
          <div><h2>Record Payment</h2><p>{invoice.invoice_number} · {invoice.participant_name}</p></div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="billing-modal-body">
          {errors.detail && <div className="form-error-banner"><AlertCircle size={13} /> {errors.detail}</div>}
          <div className="billing-form-section">
            <div className="mark-paid-summary">
              <div className="paid-summary-row"><span>Invoice Total</span><strong>{fmtGBP(invoice.total)}</strong></div>
              <div className="paid-summary-row"><span>Already Paid</span><span style={{ color: '#16a34a' }}>{fmtGBP(invoice.paid_amount || 0)}</span></div>
              <div className="paid-summary-row balance"><span>Balance Due</span><strong>{fmtGBP(invoice.balance_due || invoice.total)}</strong></div>
            </div>
          </div>
          <div className="billing-form-section">
            <div className="billing-form-grid-3">
              <div className="edit-field">
                <label>Amount Received (£) *</label>
                <input type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} />
              </div>
              <div className="edit-field">
                <label>Payment Method *</label>
                <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="bacs">BACS</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div className="edit-field">
                <label>Payment Date *</label>
                <input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
              </div>
            </div>
            <div className="edit-field">
              <label>Reference / Transaction ID</label>
              <input value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="Bank reference, transaction ID…" />
            </div>
            <div className="edit-field">
              <label>Notes</label>
              <textarea rows={2} className="billing-notes" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional payment notes…" />
            </div>
          </div>
        </div>
        <div className="billing-modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.amount || !form.payment_date}>
            {mutation.isPending ? 'Recording…' : <><CheckCircle size={14} /> Record Payment & Issue Receipt</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function InvoicePrintModal({ invoice, onClose }) {
  const printRef = useRef();
  const sm = STATUS_META[invoice.status] || STATUS_META.draft;
  const subtotal = +invoice.subtotal || +invoice.total || 0;
  const vat = +invoice.vat_amount || 0;
  const total = +invoice.total || 0;

  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(buildPrintHTML(printRef.current.innerHTML, invoice.invoice_number));
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="invoice-view-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
        <div className="invoice-modal-actions">
          <span className="inv-modal-title">{invoice.invoice_number}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-outline-sm" onClick={handlePrint}><Printer size={14} /> Print / PDF</button>
            <button className="modal-close" onClick={onClose}><X size={16} /></button>
          </div>
        </div>
        <div className="invoice-print-wrap" ref={printRef}>
          <div className="print-wrap">
            <div className="inv-print-header">
              <div>
                <div className="inv-print-logo">BioLuminux</div>
                <div className="inv-print-logo-sub">Clinical Research CRM</div>
                <div className="inv-print-address">London, United Kingdom · finance@bioluminux.com</div>
              </div>
              <div className="inv-print-meta">
                <div className="inv-print-num">{invoice.invoice_number}</div>
                <div className="inv-print-status" style={{ background: sm.bg, color: sm.color }}>{sm.label}</div>
                <div className="inv-print-meta-row">Issued: {fmtDate(invoice.issued_at)}</div>
                <div className="inv-print-meta-row">Due: {fmtDate(invoice.due_at)}</div>
                {invoice.paid_at && <div className="inv-print-meta-row" style={{ color: '#16a34a' }}>Paid: {fmtDate(invoice.paid_at)}</div>}
              </div>
            </div>
            <div className="inv-print-parties">
              <div>
                <div className="party-label">From</div>
                <div className="party-name">BioLuminux Clinical Research</div>
                <div className="party-detail">London, United Kingdom</div>
                <div className="party-detail">finance@bioluminux.com</div>
                {invoice.study_reference && <div className="party-detail" style={{ marginTop: 6, fontWeight: 600 }}>Study Ref: {invoice.study_reference}</div>}
              </div>
              <div>
                <div className="party-label">Bill To</div>
                <div className="party-name">{invoice.participant_name || invoice.participant?.name}</div>
                <div className="party-detail">Clinical Trial Participant</div>
              </div>
            </div>
            <table className="inv-print-table">
              <thead><tr><th>Description</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {(invoice.items || []).map((it, i) => (
                  <tr key={i}>
                    <td>{it.description}</td>
                    <td className="text-right">{it.quantity || it.qty}</td>
                    <td className="text-right">{fmtGBP(it.unit_rate || it.rate)}</td>
                    <td className="text-right">{fmtGBP(it.amount || ((it.quantity || it.qty) * (it.unit_rate || it.rate)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="inv-print-totals">
              <div className="inv-total-row"><span>Subtotal</span><span>{fmtGBP(subtotal)}</span></div>
              {vat > 0 && <div className="inv-total-row"><span>VAT ({invoice.vat_rate}%)</span><span>{fmtGBP(vat)}</span></div>}
              <div className="inv-total-row grand"><span>Total Due</span><span>{fmtGBP(total)}</span></div>
              {+invoice.paid_amount > 0 && (
                <>
                  <div className="inv-total-row" style={{ color: '#16a34a' }}><span>Amount Paid</span><span>({fmtGBP(invoice.paid_amount)})</span></div>
                  <div className="inv-total-row outstanding"><span>Balance Due</span><span>{fmtGBP(invoice.balance_due || 0)}</span></div>
                </>
              )}
            </div>
            {invoice.notes && (
              <div className="inv-print-notes">
                <div className="notes-label">Notes & Payment Terms</div>
                <p>{invoice.notes}</p>
              </div>
            )}
            <div className="inv-print-footer">
              Thank you for participating in BioLuminux clinical research.<br />
              For billing enquiries contact finance@bioluminux.com
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ReceiptPrintModal({ invoice, onClose }) {
  const printRef = useRef();

  const { data: receiptsData } = useQuery({
    queryKey: ['receipts', { invoice: invoice.id }],
    queryFn: () => getReceipts({ invoice: invoice.id }).then(r => r.data.results || r.data),
  });

  const receipts = receiptsData || [];
  const latestReceipt = receipts[0];

  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(buildPrintHTML(printRef.current.innerHTML, `Receipt – ${invoice.invoice_number}`));
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="invoice-view-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
        <div className="invoice-modal-actions">
          <span className="inv-modal-title">{latestReceipt?.receipt_number || 'Receipt'}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-outline-sm" onClick={handlePrint}><Printer size={14} /> Print / PDF</button>
            <button className="modal-close" onClick={onClose}><X size={16} /></button>
          </div>
        </div>
        <div className="invoice-print-wrap" ref={printRef}>
          <div className="print-wrap">
            <div className="inv-print-header">
              <div>
                <div className="inv-print-logo">BioLuminux</div>
                <div className="inv-print-logo-sub">Clinical Research CRM</div>
                <div className="inv-print-address">London, United Kingdom · finance@bioluminux.com</div>
              </div>
              <div className="inv-print-meta">
                <div className="inv-print-num">{latestReceipt?.receipt_number || 'RECEIPT'}</div>
                <div className="inv-print-status" style={{ background: '#dcfce7', color: '#16a34a' }}>PAID IN FULL</div>
                <div className="inv-print-meta-row">Invoice: {invoice.invoice_number}</div>
                <div className="inv-print-meta-row">Payment Date: {fmtDate(latestReceipt?.payment_date || invoice.paid_at)}</div>
                <div className="inv-print-meta-row">Method: {humanize(latestReceipt?.payment_method || invoice.payment_method)}</div>
              </div>
            </div>

            {/* Receipt banner */}
            <div className="receipt-paid-banner">
              <CheckCircle size={32} style={{ color: '#16a34a' }} />
              <div>
                <div className="receipt-paid-title">Payment Received</div>
                <div className="receipt-paid-sub">This receipt confirms payment has been successfully received.</div>
              </div>
            </div>

            <div className="inv-print-parties">
              <div>
                <div className="party-label">Received By</div>
                <div className="party-name">BioLuminux Clinical Research</div>
                <div className="party-detail">London, United Kingdom</div>
                <div className="party-detail">finance@bioluminux.com</div>
              </div>
              <div>
                <div className="party-label">Received From</div>
                <div className="party-name">{invoice.participant_name || invoice.participant?.name}</div>
                <div className="party-detail">Clinical Trial Participant</div>
              </div>
            </div>

            <table className="inv-print-table">
              <thead><tr><th>Description</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {(invoice.items || []).map((it, i) => (
                  <tr key={i}>
                    <td>{it.description}</td>
                    <td className="text-right">{it.quantity || it.qty}</td>
                    <td className="text-right">{fmtGBP(it.unit_rate || it.rate)}</td>
                    <td className="text-right">{fmtGBP(it.amount || ((it.quantity || it.qty) * (it.unit_rate || it.rate)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="inv-print-totals">
              <div className="inv-total-row"><span>Invoice Total</span><span>{fmtGBP(invoice.total)}</span></div>
              <div className="inv-total-row" style={{ color: '#16a34a' }}><span>Amount Paid</span><span>{fmtGBP(latestReceipt?.amount_received || invoice.paid_amount || invoice.total)}</span></div>
              <div className="inv-total-row grand" style={{ color: '#16a34a' }}><span>Balance Due</span><span>£0.00</span></div>
            </div>

            {latestReceipt?.reference && (
              <div className="inv-print-notes">
                <div className="notes-label">Payment Reference</div>
                <p>{latestReceipt.reference}</p>
              </div>
            )}

            <div className="inv-print-footer">
              This is an official payment receipt from BioLuminux Clinical Research.<br />
              Please retain for your records. For enquiries contact finance@bioluminux.com
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function buildPrintHTML(content, title) {
  return `<html><head><title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', Arial, sans-serif; color: #0d2118; background: white; }
    .print-wrap { max-width: 800px; margin: 0 auto; padding: 48px; }
    .inv-print-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid #2a9c5c; }
    .inv-print-logo { font-size: 26px; font-weight: 800; color: #2a9c5c; }
    .inv-print-logo-sub { font-size: 12px; color: #7a9e8a; margin-top: 2px; }
    .inv-print-address { font-size: 12px; color: #7a9e8a; margin-top: 6px; }
    .inv-print-meta { text-align: right; }
    .inv-print-num { font-size: 20px; font-weight: 700; color: #0d2118; margin-bottom: 6px; }
    .inv-print-status { display: inline-block; padding: 4px 14px; border-radius: 99px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
    .inv-print-meta-row { font-size: 12px; color: #7a9e8a; margin-top: 3px; }
    .receipt-paid-banner { display: flex; align-items: center; gap: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px 20px; margin-bottom: 28px; }
    .receipt-paid-title { font-size: 16px; font-weight: 700; color: #16a34a; }
    .receipt-paid-sub { font-size: 12px; color: #3d6b4f; margin-top: 2px; }
    .inv-print-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; padding: 20px; background: #f3f8f5; border-radius: 10px; }
    .party-label { font-size: 10px; font-weight: 700; color: #7a9e8a; text-transform: uppercase; letter-spacing: 0.09em; margin-bottom: 6px; }
    .party-name { font-size: 16px; font-weight: 700; color: #0d2118; margin-bottom: 3px; }
    .party-detail { font-size: 12px; color: #3d6b4f; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead th { background: #2a9c5c; color: white; padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
    thead th:last-child, thead th:nth-child(2), thead th:nth-child(3) { text-align: right; }
    td { padding: 11px 14px; font-size: 13px; border-bottom: 1px solid #ddeee5; color: #0d2118; }
    .text-right { text-align: right; }
    tbody tr:nth-child(even) { background: #f3f8f5; }
    .inv-print-totals { margin-left: auto; width: 300px; display: flex; flex-direction: column; gap: 6px; margin-bottom: 28px; }
    .inv-total-row { display: flex; justify-content: space-between; font-size: 13px; color: #3d6b4f; padding: 5px 0; border-bottom: 1px solid #ddeee5; }
    .inv-total-row.grand { font-size: 17px; font-weight: 700; color: #2a9c5c; padding-top: 12px; border-top: 2px solid #2a9c5c; border-bottom: none; }
    .inv-total-row.outstanding { font-weight: 700; color: #0d2118; border-bottom: none; font-size: 14px; }
    .inv-print-notes { margin-bottom: 24px; padding: 16px; background: #f3f8f5; border-radius: 10px; border-left: 3px solid #2a9c5c; }
    .notes-label { font-size: 11px; font-weight: 700; color: #7a9e8a; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
    .inv-print-notes p { font-size: 13px; color: #3d6b4f; line-height: 1.5; }
    .inv-print-footer { text-align: center; font-size: 11px; color: #7a9e8a; padding-top: 20px; border-top: 1px solid #ddeee5; line-height: 1.6; }
  </style></head><body>${content}</body></html>`;
}
