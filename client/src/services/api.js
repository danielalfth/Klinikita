import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT token for staff
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('klinikita_jwt');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const getMe = () => api.get('/auth/me');

// Public
export const getPublicInfo      = ()     => api.get('/public/info');
export const getPublicSchedule  = ()     => api.get('/public/schedule');
export const takeTicket         = (poli) => api.post('/public/queue/take', { poli });
export const getQueueStatus     = (token) => api.get('/public/queue/status', { headers: { 'X-Access-Token': token } });
export const getPatientPDFUrl   = (id, token) => `${BASE}/public/medical-records/${id}/pdf?token=${encodeURIComponent(token)}`;

// Admin — Queues
export const getAdminQueues = (poli, date) => api.get('/admin/queues', { params: { poli, date } });
export const callQueue      = (id)         => api.post(`/admin/queues/${id}/call`);
export const skipQueue      = (id)         => api.post(`/admin/queues/${id}/skip`);
export const recallQueue    = (id)         => api.post(`/admin/queues/${id}/recall`);
export const assignQueue    = (id, data)   => api.post(`/admin/queues/${id}/assign`, data);
export const linkPatient    = (id, pid)    => api.post(`/admin/queues/${id}/link-patient`, { patient_id: pid });

// Admin — Patients
export const searchPatients = (q)    => api.get('/admin/patients/search', { params: { q } });
export const createPatient  = (data) => api.post('/admin/patients', data);

// Admin — Doctors
export const getActiveDoctors = (poli) => api.get('/admin/doctors/active', { params: { poli } });

// Admin — Medical Records (read-only)
export const getAllMedicalRecords  = (q = '') => api.get('/admin/medical-records', { params: { q } });
export const getAdminPDFUrl        = (id)     => {
  const token = localStorage.getItem('klinikita_jwt');
  return `${BASE}/admin/medical-records/${id}/pdf?token=${encodeURIComponent(token)}`;
};

// Doctor — Queues
export const getDoctorQueues = ()         => api.get('/doctor/queues');
export const callInQueue     = (id)       => api.post(`/doctor/queues/${id}/call-in`);
export const completeQueue   = (id, data) => api.post(`/doctor/queues/${id}/complete`, data);

// Doctor — Medical Records per pasien
export const getPatientRecords  = (patient_id) => api.get(`/doctor/patients/${patient_id}/records`);
export const updateMedicalRecord = (id, data)  => api.put(`/doctor/medical-records/${id}`, data);
export const getPDFUrl           = (id)         => {
  const token = localStorage.getItem('klinikita_jwt');
  return `${BASE}/doctor/medical-records/${id}/pdf?token=${encodeURIComponent(token)}`;
};

// Doctor — Medical Records semua pasien
export const getDoctorAllMedicalRecords = (q = '') => api.get('/doctor/medical-records', { params: { q } });

// Doctor — Shift
export const getShiftStatus = () => api.get('/doctor/shift-status');

export default api;
