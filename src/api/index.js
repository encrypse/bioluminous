import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh });
          localStorage.setItem('access_token', data.access);
          api.defaults.headers.Authorization = `Bearer ${data.access}`;
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────
export const login = (email, password) =>
  api.post('/auth/login/', { username: email, password });

export const getMe = () => api.get('/auth/me/');

// ── Participants ───────────────────────────────────────────
export const getParticipants = (params) => api.get('/participants/', { params });
export const getParticipant = (id) => api.get(`/participants/${id}/`);
export const createParticipant = (data) => api.post('/participants/', data);
export const updateParticipant = (id, data) => api.patch(`/participants/${id}/`, data);
export const deleteParticipant = (id) => api.delete(`/participants/${id}/`);

// ── Dashboard ──────────────────────────────────────────────
export const getDashboardStats = (params) => api.get('/dashboard/stats/', { params });

// ── Campaigns ─────────────────────────────────────────────
export const getCampaigns = () => api.get('/campaigns/');

// ── Bookings ───────────────────────────────────────────────
export const getBookings = (params) => api.get('/bookings/', { params });
export const getBooking = (id) => api.get(`/bookings/${id}/`);
export const createBooking = (data) => api.post('/bookings/', data);
export const updateBooking = (id, data) => api.patch(`/bookings/${id}/`, data);
export const deleteBooking = (id) => api.delete(`/bookings/${id}/`);

// ── Calls ──────────────────────────────────────────────────
export const getCalls = (params) => api.get('/calls/', { params });
export const getCallStats = (params) => api.get('/calls/stats/', { params });
export const createCall = (data) => api.post('/calls/', data);
export const updateCall = (id, data) => api.patch(`/calls/${id}/`, data);

// ── Tasks ──────────────────────────────────────────────────
export const getTasks = (params) => api.get('/tasks/', { params });
export const createTask = (data) => api.post('/tasks/', data);
export const updateTask = (id, data) => api.patch(`/tasks/${id}/`, data);
export const deleteTask = (id) => api.delete(`/tasks/${id}/`);

// ── Communications ─────────────────────────────────────────
export const getCommunications = (params) => api.get('/communications/', { params });
export const createCommunication = (data) => api.post('/communications/', data);
export const getCommStats = (params) => api.get('/communications/stats/', { params });

// ── Staff ──────────────────────────────────────────────────
export const getStaff = () => api.get('/staff/');
export const createStaff = (data) => api.post('/staff/', data);
export const updateStaff = (id, data) => api.patch(`/staff/${id}/`, data);

// ── Notifications ──────────────────────────────────────────
export const getNotifications = () => api.get('/notifications/');
export const markNotificationRead = (id) => api.post(`/notifications/${id}/read/`);

// ── Audit Trail ────────────────────────────────────────────
export const getAuditTrail = (params) => api.get('/audit-trail/', { params });

// ── Billing / Invoices ─────────────────────────────────────
export const getInvoices = (params) => api.get('/invoices/', { params });
export const getInvoice = (id) => api.get(`/invoices/${id}/`);
export const createInvoice = (data) => api.post('/invoices/', data);
export const updateInvoice = (id, data) => api.patch(`/invoices/${id}/`, data);
export const deleteInvoice = (id) => api.delete(`/invoices/${id}/`);
export const markInvoicePaid = (id, data) => api.post(`/invoices/${id}/mark-paid/`, data);
export const getBillingStats = () => api.get('/billing/stats/');

// ── Receipts ───────────────────────────────────────────────
export const getReceipts = (params) => api.get('/receipts/', { params });
export const getReceipt = (id) => api.get(`/receipts/${id}/`);

// ── Studies ────────────────────────────────────────────────
export const getStudies = (params) => api.get('/studies/', { params });
export const getStudy = (id) => api.get(`/studies/${id}/`);
export const createStudy = (data) => api.post('/studies/', data);
export const updateStudy = (id, data) => api.patch(`/studies/${id}/`, data);
export const getResearchStats = () => api.get('/research/stats/');

// ── Documents ──────────────────────────────────────────────
export const getDocuments = (params) => api.get('/documents/', { params });
export const getDocument = (id) => api.get(`/documents/${id}/`);
export const uploadDocument = (data) => api.post('/documents/', data, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteDocument = (id) => api.delete(`/documents/${id}/`);

// ── Pipeline Stages ────────────────────────────────────────
export const getPipelineStages = () => api.get('/pipeline-stages/');
export const savePipelineStages = (stages) => api.patch('/pipeline-stages/', stages);
