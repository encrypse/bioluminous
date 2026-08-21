import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDocuments, uploadDocument } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  File, FileText, FilePlus, Upload, Search, Download, Eye,
  Trash2, X, Check, FolderOpen, Clock, User, Filter,
  Shield, BookOpen, ClipboardList, BarChart2, FileCog,
  ChevronDown, AlertCircle, CheckCircle, Tag
} from 'lucide-react';
import './Documents.css';

const CATEGORIES = [
  { key: 'all',           label: 'All Documents', icon: FolderOpen },
  { key: 'consent',       label: 'Consent Forms',  icon: Shield },
  { key: 'protocol',      label: 'Protocols',      icon: BookOpen },
  { key: 'sop',           label: 'SOPs',           icon: ClipboardList },
  { key: 'report',        label: 'Reports',        icon: BarChart2 },
  { key: 'ethics',        label: 'Ethics / IRB',   icon: CheckCircle },
  { key: 'other',         label: 'Other',          icon: File },
];

const FILE_ICON_MAP = {
  pdf:  { color: '#dc2626', bg: '#fef2f2', label: 'PDF' },
  docx: { color: '#2563eb', bg: '#eff6ff', label: 'DOCX' },
  doc:  { color: '#2563eb', bg: '#eff6ff', label: 'DOC' },
  xlsx: { color: '#16a34a', bg: '#dcfce7', label: 'XLSX' },
  csv:  { color: '#059669', bg: '#ecfdf5', label: 'CSV' },
  pptx: { color: '#d97706', bg: '#fef3c7', label: 'PPTX' },
  png:  { color: '#6366f1', bg: '#e0e7ff', label: 'PNG' },
  jpg:  { color: '#8b5cf6', bg: '#f5f3ff', label: 'JPG' },
};

const STATUS_META = {
  approved:       { label: 'Approved',        color: '#16a34a', bg: '#dcfce7' },
  pending_review: { label: 'Pending Review',  color: '#d97706', bg: '#fef3c7' },
  draft:          { label: 'Draft',           color: '#6b7280', bg: '#f3f4f6' },
  superseded:     { label: 'Superseded',      color: '#9f1239', bg: '#fff1f2' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Documents() {
  const qc = useQueryClient();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const fileInputRef = useRef();

  const quickUploadMutation = useMutation({
    mutationFn: (formData) => uploadDocument(formData),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  const handleQuickUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', file.name);
    quickUploadMutation.mutate(fd);
    e.target.value = '';
  };

  const { data: docsData } = useQuery({
    queryKey: ['documents', { category: category !== 'all' ? category : undefined, search }],
    queryFn: () => getDocuments({ category: category !== 'all' ? category : undefined, search }).then(r => r.data.results || r.data),
  });

  const docs = docsData || [];

  const filtered = docs.filter(d => {
    const matchCat = category === 'all' || d.category === category;
    const q = search.toLowerCase();
    const matchSearch = !search || d.name.toLowerCase().includes(q) || (d.study_protocol || d.study || '').toLowerCase().includes(q) || (d.uploaded_by?.full_name || d.uploaded_by || '').toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const countBy = (key) => docs.filter(d => d.category === key).length;

  return (
    <div className="documents-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Documents</h1>
          <p className="page-sub">{docs.length} documents · SOPs, protocols, consent forms, reports</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-outline-sm" onClick={() => fileInputRef.current?.click()} disabled={quickUploadMutation.isPending}>
            <Upload size={14} /> {quickUploadMutation.isPending ? 'Uploading…' : 'Upload'}
          </button>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleQuickUpload} />
            <button className="btn-primary-sm" onClick={() => setShowUpload(true)}>
            <FilePlus size={15} /> Add Document
          </button>
        </div>
      </div>

      <div className="docs-layout">
        {/* Sidebar categories */}
        <div className="docs-sidebar">
          <div className="docs-sidebar-title">Categories</div>
          {CATEGORIES.map(cat => {
            const count = cat.key === 'all' ? docs.length : countBy(cat.key);
            const Icon = cat.icon;
            return (
              <button
                key={cat.key}
                className={`doc-cat-item ${category === cat.key ? 'active' : ''}`}
                onClick={() => setCategory(cat.key)}
              >
                <Icon size={14} />
                <span>{cat.label}</span>
                <span className="doc-cat-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Main content */}
        <div className="docs-main">
          <div className="docs-search-bar">
            <div className="billing-search" style={{ flex: 1 }}>
              <Search size={14} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents, studies, authors…" />
            </div>
          </div>

          <div className="docs-list">
            {filtered.map((doc, i) => {
              const fi = FILE_ICON_MAP[doc.ext] || { color: '#6b7280', bg: '#f3f4f6', label: doc.ext?.toUpperCase() };
              const sm = STATUS_META[doc.status] || STATUS_META.approved;
              return (
                <motion.div
                  key={doc.id}
                  className="doc-item"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.025 }}
                  onClick={() => setSelectedDoc(doc)}
                >
                  <div className="doc-type-icon" style={{ background: fi.bg, color: fi.color }}>
                    <FileText size={16} />
                    <span className="doc-ext">{fi.label}</span>
                  </div>
                  <div className="doc-info">
                    <div className="doc-name">{doc.name}</div>
                    <div className="doc-meta-row">
                      {doc.study && <span className="doc-study">{doc.study}</span>}
                      <span className="doc-uploaded"><Clock size={10} /> {fmtDate(doc.uploaded_at)}</span>
                      <span className="doc-author"><User size={10} /> {doc.uploaded_by}</span>
                      <span className="doc-size">{doc.size}</span>
                    </div>
                  </div>
                  <div className="doc-right">
                    <span className="doc-version">Ver {doc.version}</span>
                    <span className="doc-status" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
                    <div className="doc-actions">
                      <button className="inv-action-btn" title="Download" onClick={e => { e.stopPropagation(); const url = doc.file_url || doc.url; if (url) window.open(url, '_blank'); }}>
                        <Download size={12} />
                      </button>
                      <button className="inv-action-btn" title="Preview" onClick={e => { e.stopPropagation(); setSelectedDoc(doc); }}>
                        <Eye size={12} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            {filtered.length === 0 && (
              <div className="docs-empty">
                <FolderOpen size={40} style={{ color: 'var(--primary)', opacity: 0.3, marginBottom: 12 }} />
                <p>No documents in this category</p>
                <button className="btn-primary-sm" style={{ marginTop: 12 }} onClick={() => setShowUpload(true)}>
                  <FilePlus size={14} /> Add First Document
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document Detail */}
      <AnimatePresence>
        {selectedDoc && <DocDetailModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ['documents'] }); setShowUpload(false); }} />}
      </AnimatePresence>
    </div>
  );
}

function DocDetailModal({ doc, onClose }) {
  const fi = FILE_ICON_MAP[doc.ext] || { color: '#6b7280', bg: '#f3f4f6', label: doc.ext?.toUpperCase() };
  const sm = STATUS_META[doc.status] || STATUS_META.approved;

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="doc-detail-modal" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
        <div className="doc-detail-header">
          <div className="doc-type-icon-lg" style={{ background: fi.bg, color: fi.color }}>
            <FileText size={24} />
            <span>{fi.label}</span>
          </div>
          <div className="doc-detail-info">
            <div className="doc-detail-name">{doc.name}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <span style={{ background: sm.bg, color: sm.color, padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{sm.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Version {doc.version}</span>
              {doc.study && <span className="doc-study">{doc.study}</span>}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="doc-detail-body">
          {doc.description && (
            <div className="doc-desc-section">
              <div className="doc-section-label">Description</div>
              <p className="doc-desc-text">{doc.description}</p>
            </div>
          )}

          <div className="doc-meta-section">
            {[
              { label: 'Category', value: CATEGORIES.find(c => c.key === doc.category)?.label || doc.category },
              { label: 'File Type', value: fi.label },
              { label: 'File Size', value: doc.size },
              { label: 'Version', value: doc.version },
              { label: 'Uploaded By', value: doc.uploaded_by },
              { label: 'Upload Date', value: fmtDate(doc.uploaded_at) },
              doc.study && { label: 'Study', value: doc.study },
            ].filter(Boolean).map(f => (
              <div key={f.label} className="doc-meta-field">
                <div className="info-label">{f.label}</div>
                <div className="info-value">{f.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="doc-detail-footer">
          <button className="btn-ghost">View Version History</button>
          <button className="btn-primary-sm" onClick={() => { const url = doc.file_url || doc.url; if (url) window.open(url, '_blank'); }}><Download size={14} /> Download</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function UploadModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: '', category: 'consent', study: '', version: 'v1.0',
    status: 'draft', description: '',
  });
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const fileRef = useRef();

  const mutation = useMutation({
    mutationFn: (formData) => uploadDocument(formData),
    onSuccess,
    onError: (err) => setErrors(err.response?.data || { detail: 'Upload failed' }),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    const parts = f.name.split('.');
    parts.pop();
    set('name', parts.join('.') || f.name);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = () => {
    const fd = new FormData();
    fd.append('name', form.name || file?.name || 'Untitled Document');
    fd.append('category', form.category);
    fd.append('version', form.version);
    fd.append('status', form.status);
    fd.append('description', form.description);
    if (form.study) fd.append('study', form.study);
    if (file) fd.append('file', file);
    mutation.mutate(fd);
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="billing-modal" style={{ width: 580 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()}>
        <div className="billing-modal-header">
          <div><h2>Add Document</h2><p>Upload or register a new document</p></div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="billing-modal-body">
          {/* Drop Zone */}
          <div
            className={`doc-drop-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            {file ? (
              <div className="drop-file-info">
                <CheckCircle size={24} style={{ color: '#16a34a' }} />
                <div><div className="drop-file-name">{file.name}</div><div className="drop-file-size">{Math.round(file.size / 1024)} KB</div></div>
              </div>
            ) : (
              <div className="drop-empty">
                <Upload size={28} style={{ color: 'var(--primary)', opacity: 0.6 }} />
                <div>Drag a file here or <span style={{ color: 'var(--primary)', fontWeight: 600 }}>browse</span></div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>PDF, DOCX, XLSX, PPTX, JPG, PNG</div>
              </div>
            )}
          </div>

          {/* Form */}
          <div className="billing-form-section">
            <div className="billing-form-grid-3">
              <div className="edit-field" style={{ gridColumn: '1/3' }}>
                <label>Document Name *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Informed Consent Form v2.0" />
              </div>
              <div className="edit-field">
                <label>Version</label>
                <input value={form.version} onChange={e => set('version', e.target.value)} placeholder="v1.0" />
              </div>
            </div>
            <div className="billing-form-grid-3">
              <div className="edit-field">
                <label>Category</label>
                <select value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.filter(c => c.key !== 'all').map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div className="edit-field">
                <label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="edit-field">
                <label>Study (optional)</label>
                <input value={form.study} onChange={e => set('study', e.target.value)} placeholder="BIO-XXXX-001" />
              </div>
            </div>
            <div className="edit-field">
              <label>Description</label>
              <textarea rows={2} className="billing-notes" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description of this document…" />
            </div>
          </div>
        </div>
        <div className="billing-modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={mutation.isPending || (!form.name && !file)}>
            {mutation?.isPending ? 'Uploading…' : <><Upload size={14} /> Add Document</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
