# Inventory Management System - Setup Guide

## Frontend Setup

This React application is designed to work with your FastAPI backend. Follow these steps to connect them:

### 1. Configure API Endpoint

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
cp .env.example .env
```

Update the `VITE_API_BASE_URL` in your `.env` file to point to your FastAPI backend:

```env
VITE_API_BASE_URL=http://localhost:8000
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:8080`

## Features

### Purchase Planning Module (`/shipments`)
- Create bulk shipments for supplier orders
- Add customer pre-order requests
- Generate supplier invoices
- Track shipment status (Planning → Ordered → Received)
- Automatically creates orders in Sales Hub with "Awaiting Stock" status

### Sales Hub Module (`/orders`)
- Manage all customer orders (pre-orders, local, and Amazon sales)
- Filter orders by status (All, Awaiting Stock, Ready to Ship, Completed, Cancelled)
- Complete orders (automatically deducts from inventory)
- Cancel orders (returns items to inventory if needed)
- Create new orders for local and Amazon sales

### Inventory Module (`/inventory`)
- Real-time view of all products in stock
- Search by product name or SKU
- Automatically updated by Purchase Planning and Sales Hub actions

## API Integration

The frontend expects the following FastAPI endpoints to be available:

**Purchase Planning:**
- `GET /shipments` - List all shipments
- `POST /shipments` - Create new shipment
- `GET /shipments/{id}` - Get shipment details
- `POST /shipments/{id}/requests` - Add customer request
- `PUT /shipments/{id}/status` - Update shipment status

**Sales Hub:**
- `GET /orders` - List all orders (supports `?status=` filter)
- `POST /orders` - Create new order
- `PUT /orders/{id}` - Update order
- `POST /orders/{id}/complete` - Mark order as completed
- `POST /orders/{id}/cancel` - Cancel order

**Inventory & Products:**
- `GET /inventory` - Get all inventory items
- `GET /products?search={query}` - Search products for autocomplete

## Tech Stack

- **React** with Hooks
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **Axios** for API communication
- **React Router** for navigation
- **Vite** for fast development

## Development Notes

- The app automatically navigates to `/shipments` as the default landing page
- All API calls include proper error handling with toast notifications
- Product search fields provide real-time autocomplete suggestions
- Low stock items (< 10) are highlighted in red in the Inventory view
