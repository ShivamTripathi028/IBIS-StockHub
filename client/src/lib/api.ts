import axios from 'axios';

// Configure your FastAPI backend URL here
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Purchase Planning API
export const shipmentsApi = {
  getAll: () => api.get('/shipments'),
  create: () => api.post('/shipments'),
  getById: (id: string) => api.get(`/shipments/${id}`),
  addRequest: (id: string, data: any) => api.post(`/shipments/${id}/requests`, data),
  updateStatus: (id: string, status: string) => api.put(`/shipments/${id}/status`, { status }),
};

// Sales Hub API
export const ordersApi = {
  getAll: (status?: string) => api.get('/orders', { params: status ? { status } : {} }),
  create: (data: any) => api.post('/orders', data),
  update: (id: string, data: any) => api.put(`/orders/${id}`, data),
  complete: (id: string) => api.post(`/orders/${id}/complete`),
  cancel: (id: string) => api.post(`/orders/${id}/cancel`),
  hold: (id: string) => api.post(`/orders/${id}/hold`),
};

// Inventory API
export const inventoryApi = {
  getAll: () => api.get('/inventory'),
};

// Products API
export const productsApi = {
  search: (query: string) => api.get('/products', { params: { search: query } }),
};

export default api;
