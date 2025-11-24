import axios from 'axios';

// The VITE_API_BASE_URL should be http://localhost:8000/api
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- TYPE DEFINITIONS for API Payloads ---
// These types match the Pydantic schemas in our FastAPI backend.

// For adding a line item to a shipment
export interface ShipmentRequestPayload {
  customer_name?: string | null;
  product_id: string;
  quantity: number;
}

// For creating a new order
export interface OrderPayload {
  customer_name: string;
  source: 'Local' | 'Amazon'; // Matches the OrderSource enum
  line_items: {
    product_id: string;
    quantity: number;
  }[];
}

// NOTE: We haven't implemented a generic 'update' on the backend,
// but for type safety, we can define a potential shape.
export interface OrderUpdatePayload {
  customer_name?: string;
  // Add other fields you might want to update
}


// --- API Function Definitions ---

// Purchase Planning API
export const shipmentsApi = {
  getAll: () => api.get('/shipments'),
  create: () => api.post('/shipments'),
  getById: (id: string) => api.get(`/shipments/${id}`),
  // Use our new, specific type instead of 'any'
  addRequest: (id: string, data: ShipmentRequestPayload) => api.post(`/shipments/${id}/requests`, data),
  updateStatus: (id: string, status: string) => api.put(`/shipments/${id}/status`, { status }),
};

// Sales Hub API
export const ordersApi = {
  getAll: (status?: string) => api.get('/orders', { params: status ? { status } : {} }),
  // Use our new, specific type instead of 'any'
  create: (data: OrderPayload) => api.post('/orders', data),
  // Use our new, specific type instead of 'any'
  update: (id: string, data: OrderUpdatePayload) => api.put(`/orders/${id}`, data),
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