import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export interface ShipmentRequestPayload {
  customer_name?: string | null;
  product_id: string;
  quantity: number;
}

// NEW: Batch Interface
export interface ShipmentBatchPayload {
  customer_name?: string | null;
  items: {
    product_id: string;
    quantity: number;
  }[];
}

export interface OrderPayload {
  customer_name: string;
  source: 'Local' | 'Amazon';
  line_items: { product_id: string; quantity: number }[];
}

export interface InvoiceItem {
  sku: string;
  product_name: string;
  total_quantity: number;
}

export interface InvoiceData {
  shipment_name: string;
  items: InvoiceItem[];
  total_items: number;
}

export interface OrderUpdatePayload { customer_name?: string; }

export const shipmentsApi = {
  getAll: () => api.get('/shipments'),
  create: (data: { name: string }) => api.post('/shipments', data),
  getById: (id: string) => api.get(`/shipments/${id}`),
  addRequest: (id: string, data: ShipmentRequestPayload) => api.post(`/shipments/${id}/requests`, data),
  addBatchRequests: (id: string, data: ShipmentBatchPayload) => api.post(`/shipments/${id}/requests/batch`, data),
  updateStatus: (id: string, status: string) => api.put(`/shipments/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/shipments/${id}`),
  
  deleteRequest: (requestId: string) => api.delete(`/shipments/requests/${requestId}`),
  updateRequest: (requestId: string, quantity: number) => api.patch(`/shipments/requests/${requestId}`, { quantity }),
  getInvoicePreview: (id: string) => api.get<InvoiceData>(`/shipments/${id}/invoice/preview`),
  downloadInvoice: (id: string) => api.get(`/shipments/${id}/invoice/download`, { responseType: 'blob' }),
};

export const ordersApi = {
  getAll: (status?: string) => api.get('/orders', { params: status ? { status } : {} }),
  create: (data: OrderPayload) => api.post('/orders', data),
  update: (id: string, data: OrderUpdatePayload) => api.put(`/orders/${id}`, data),
  complete: (id: string) => api.post(`/orders/${id}/complete`),
  cancel: (id: string) => api.post(`/orders/${id}/cancel`),
  hold: (id: string) => api.post(`/orders/${id}/hold`),
};

export const inventoryApi = { getAll: () => api.get('/inventory') };
export const productsApi = { search: (query: string) => api.get('/products', { params: { search: query } }) };
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getLowStock: () => api.get('/dashboard/low-stock'),
};

export default api;